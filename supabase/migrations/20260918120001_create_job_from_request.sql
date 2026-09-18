-- ========================================================================================
-- "Criar processo seletivo" — a única porta pela qual uma solicitação vira vaga.
--
-- Roda como UMA transação e com `for update` na solicitação, o que resolve de uma vez os
-- três riscos do fluxo antigo (a vaga nascia dentro do POST /api/jobs, sem trava):
--   • aprovar/criar duas vezes em cliques simultâneos;
--   • vaga criada sem o vínculo de volta na solicitação (falha entre insert e update);
--   • status inconsistente (APPROVED sem vaga, ou vaga órfã).
--
-- SECURITY INVOKER de propósito: quem chama é o client do usuário e a RLS continua sendo a
-- fonte de verdade da autorização (só ADMIN_RH escreve em jobs / job_requests).
-- ========================================================================================

create or replace function public.create_job_from_request(
  p_request_id    uuid,
  p_actor_user_id text,
  p_actor_name    text,
  p_slug_base     text
)
returns table (job_id text, job_code text, request_code text)
language plpgsql
as $fn$
declare
  r            public.job_requests%rowtype;
  v_slug       text;
  v_suffix     int := 1;
  v_job_id     text;
  v_job_code   text;
  v_salary_txt text;
  v_desc       text;
begin
  -- Trava a linha: uma segunda chamada concorrente espera aqui e depois falha no guard.
  select * into r from public.job_requests where id = p_request_id for update;
  if not found then
    raise exception 'Solicitação não encontrada.' using errcode = 'P0002';
  end if;

  if r.job_id is not null then
    raise exception 'Esta solicitação já gerou a vaga %.', r.job_id using errcode = 'P0001';
  end if;

  if r.status <> 'APPROVED' then
    raise exception 'Só uma solicitação aprovada pode gerar processo seletivo (status atual: %).', r.status
      using errcode = 'P0001';
  end if;

  -- ── Slug único ───────────────────────────────────────────────────────────────────────
  v_slug := coalesce(nullif(p_slug_base, ''), 'vaga');
  while exists (select 1 from public."jobs" where "slug" = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := coalesce(nullif(p_slug_base, ''), 'vaga') || '-' || v_suffix::text;
  end loop;

  -- ── Faixa salarial → texto exibido no portal (jobs.salaryRange) ──────────────────────
  v_salary_txt := case
    when r.salary_min is not null and r.salary_max is not null and r.salary_max > r.salary_min
      then 'R$ ' || to_char(r.salary_min, 'FM999G999G990D00') || ' – R$ ' || to_char(r.salary_max, 'FM999G999G990D00')
    when r.salary_min is not null then 'A partir de R$ ' || to_char(r.salary_min, 'FM999G999G990D00')
    when r.salary_max is not null then 'Até R$ ' || to_char(r.salary_max, 'FM999G999G990D00')
    else null
  end;

  -- ── Esqueleto do texto da vaga (o RH reescreve no editor antes de publicar) ──────────
  v_desc := '### Responsabilidades' || E'\n\n' ||
            coalesce(nullif(r.justification, ''), '') || E'\n\n' ||
            '### Requisitos' || E'\n\n' || E'\n\n' ||
            '### Benefícios' || E'\n\n';

  -- ── A vaga (sempre Rascunho: publicar é decisão operacional do RH) ──────────────────
  insert into public."jobs" (
    "title", "department", "company", "city", "state", "isTalentPool",
    "modality", "contractType", "description", "workSchedule", "salaryRange",
    "openings", "responsible", "hiringManager", "requestId",
    "slug", "hiringDeadline", "status"
  ) values (
    coalesce(nullif(r.title, ''), 'Vaga sem título'),
    r.department,
    r.location,
    null, null, false,
    coalesce(r.modality, 'PRESENTIAL'::"Modality"),
    coalesce(r.contract_type, 'CLT'::"ContractType"),
    v_desc,
    r.work_schedule,
    v_salary_txt,
    r.openings,
    p_actor_name,
    coalesce(r.requester_name, ''),
    r.id,
    v_slug,
    case when r.desired_start_date is not null then r.desired_start_date::timestamptz else null end,
    'DRAFT'::"JobStatus"
  )
  returning "id", "code" into v_job_id, v_job_code;

  -- ── Fecha o vínculo nos dois lados e move a solicitação para "Recrutamento iniciado" ──
  update public.job_requests
     set job_id = v_job_id,
         status = 'RECRUITING'
   where id = r.id;

  insert into public.job_request_history
    (request_id, event, from_status, to_status, comment, actor_user_id, actor_name)
  values
    (r.id, 'RECRUITMENT_STARTED', r.status::text, 'RECRUITING',
     'Processo seletivo ' || v_job_code || ' criado a partir desta solicitação.',
     p_actor_user_id, p_actor_name);

  insert into public."job_status_history" ("jobId", "status", "changedBy")
  values (v_job_id, 'DRAFT', coalesce(p_actor_name, 'Sistema'));

  return query select v_job_id, v_job_code, r.code;
end $fn$;

comment on function public.create_job_from_request(uuid, text, text, text) is
  'Cria a vaga a partir de uma solicitação APROVADA, em uma transação. Falha se já houver vaga.';

revoke all on function public.create_job_from_request(uuid, text, text, text) from public;
grant execute on function public.create_job_from_request(uuid, text, text, text) to authenticated, service_role;
