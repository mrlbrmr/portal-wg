-- ========================================================================================
-- POSIÇÕES DA VAGA  (vaga = processo seletivo · posição = cada contratação dentro dele)
--
--   Solicitação (REQ) ──aprovação──► Vaga (VAG) ──► Posições #01, #02… ──► contratados
--
-- Antes: jobs.openings era um número solto ("Quantidade de vagas"), editável sem rastro e
-- sem saber QUEM ocupou cada vaga. Agora:
--   • job_positions   — uma linha por posição (OPEN | FILLED | CANCELLED), com a
--                       candidatura/admissão que a ocupa. Nunca é apagada: cancelar ou
--                       liberar preserva o histórico em job_events.
--   • job_events      — linha do tempo auditável da vaga (posições, alterações de campos,
--                       criação). Mudanças de STATUS continuam em job_status_history.
--   • jobs.openings   — continua existindo (feeds, exportação, portal), mas passa a ser
--                       DERIVADO das posições por trigger: total de posições ativas.
--   • jobs.openPositions — posições ainda em aberto (o portal mostra "N vagas" restantes).
--   • jobs.approvedScope — snapshot do que a solicitação aprovou, para comparar com a vaga
--                       atual sem depender da solicitação (que pode ser reeditada).
--   • jobs.salaryPublic  — separa o salário INTERNO da divulgação no portal.
--
-- Toda mutação de posição passa por uma função plpgsql com `for update` (duas pessoas
-- clicando ao mesmo tempo não preenchem a mesma posição). SECURITY INVOKER: a RLS continua
-- sendo a fonte de verdade da autorização (só ADMIN_RH escreve).
--
-- ADITIVA: o código antigo não conhece as tabelas/colunas novas e segue funcionando
-- durante o build (openings continua sendo lido normalmente).
-- ========================================================================================

-- ─── 1. Colunas novas em jobs ─────────────────────────────────────────────────────────
alter table public."jobs"
  add column if not exists "openPositions" integer,
  add column if not exists "approvedScope" jsonb,
  add column if not exists "salaryPublic"  boolean not null default true;

comment on column public."jobs"."openings" is
  'Número de posições ativas (OPEN + FILLED). DERIVADO de job_positions por trigger — não edite direto.';
comment on column public."jobs"."openPositions" is
  'Posições ainda em aberto. DERIVADO de job_positions por trigger.';
comment on column public."jobs"."approvedScope" is
  'Snapshot do escopo aprovado na solicitação de origem (null em vagas avulsas).';
comment on column public."jobs"."salaryPublic" is
  'false = o salário é só interno; o portal não o divulga (salaryRange fica vazio).';

-- ─── 2. Posições ──────────────────────────────────────────────────────────────────────
create table if not exists public."job_positions" (
  "id"                text        primary key default gen_random_uuid()::text,
  "jobId"             text        not null references public."jobs"("id") on delete cascade,
  "positionNumber"    integer     not null check ("positionNumber" > 0),
  "status"            text        not null default 'OPEN' check ("status" in ('OPEN', 'FILLED', 'CANCELLED')),
  -- Quem ocupa (só em FILLED). candidateName é snapshot: sobrevive à exclusão da candidatura.
  "applicationId"     text        references public."applications"("id") on delete set null,
  "admissionId"       text        references public."admissions"("id") on delete set null,
  "candidateName"     text,
  "expectedStartDate" date,
  "filledAt"          timestamptz,
  "filledBy"          text,
  "cancelledAt"       timestamptz,
  "cancelledBy"       text,
  "cancelReason"      text,
  "createdAt"         timestamptz not null default now(),
  "updatedAt"         timestamptz not null default now(),
  unique ("jobId", "positionNumber"),
  constraint job_positions_filled_has_candidate
    check ("status" <> 'FILLED' or "candidateName" is not null)
);

create index if not exists "job_positions_jobId_idx" on public."job_positions" ("jobId");
create index if not exists "job_positions_applicationId_idx" on public."job_positions" ("applicationId");
-- A mesma candidatura não ocupa duas posições da mesma vaga ao mesmo tempo.
create unique index if not exists "job_positions_one_filled_per_application"
  on public."job_positions" ("jobId", "applicationId")
  where "status" = 'FILLED' and "applicationId" is not null;

drop trigger if exists set_updatedAt on public."job_positions";
create trigger set_updatedAt before update on public."job_positions"
  for each row execute procedure extensions.moddatetime("updatedAt");

-- ─── 3. Linha do tempo da vaga ────────────────────────────────────────────────────────
create table if not exists public."job_events" (
  "id"          text        primary key default gen_random_uuid()::text,
  "jobId"       text        not null references public."jobs"("id") on delete cascade,
  "positionId"  text        references public."job_positions"("id") on delete set null,
  -- JOB_CREATED | POSITIONS_MIGRATED | POSITION_ADDED | POSITION_CANCELLED |
  -- POSITION_FILLED | POSITION_RELEASED | FIELDS_UPDATED
  "type"        text        not null,
  "reason"      text,
  "data"        jsonb       not null default '{}'::jsonb,
  "actorUserId" text,
  "actorName"   text        not null default 'Sistema',
  "createdAt"   timestamptz not null default now()
);
create index if not exists "job_events_jobId_idx" on public."job_events" ("jobId", "createdAt" desc);

-- ─── 4. RLS ───────────────────────────────────────────────────────────────────────────
alter table public."job_positions" enable row level security;
alter table public."job_events"    enable row level security;

drop policy if exists "job_positions_staff_select" on public."job_positions";
create policy "job_positions_staff_select" on public."job_positions"
  for select to authenticated using (public.is_staff());
drop policy if exists "job_positions_admin_write" on public."job_positions";
create policy "job_positions_admin_write" on public."job_positions"
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Histórico é append-only: sem update/delete para ninguém além do service_role.
drop policy if exists "job_events_staff_select" on public."job_events";
create policy "job_events_staff_select" on public."job_events"
  for select to authenticated using (public.is_staff());
drop policy if exists "job_events_admin_insert" on public."job_events";
create policy "job_events_admin_insert" on public."job_events"
  for insert to authenticated with check (public.is_admin());

-- ─── 5. jobs.openings / jobs.openPositions derivados das posições ─────────────────────
create or replace function public.sync_job_position_counts() returns trigger
language plpgsql as $fn$
declare
  v_job text := coalesce(new."jobId", old."jobId");
begin
  update public."jobs" j
     set "openings"      = nullif(c.active, 0),
         "openPositions" = c.open_count
    from (
      select count(*) filter (where "status" <> 'CANCELLED')::int as active,
             count(*) filter (where "status" = 'OPEN')::int       as open_count
        from public."job_positions" where "jobId" = v_job
    ) c
   where j."id" = v_job
     and (j."openings" is distinct from nullif(c.active, 0) or j."openPositions" is distinct from c.open_count);
  return null;
end $fn$;

drop trigger if exists job_positions_sync_counts on public."job_positions";
create trigger job_positions_sync_counts
  after insert or update or delete on public."job_positions"
  for each row execute procedure public.sync_job_position_counts();

-- ─── 6. Toda vaga específica nasce com suas posições ──────────────────────────────────
-- Cobre TODOS os caminhos de criação (solicitação aprovada, "Nova vaga", duplicar): o
-- valor de `openings` informado na criação vira as posições #01..#N. Banco de talentos
-- não tem posições.
create or replace function public.create_initial_job_positions() returns trigger
language plpgsql as $fn$
begin
  if coalesce(new."isTalentPool", false) then
    return null;
  end if;
  insert into public."job_positions" ("jobId", "positionNumber")
  select new."id", n from generate_series(1, greatest(coalesce(new."openings", 1), 1)) as n;
  return null;
end $fn$;

drop trigger if exists jobs_create_initial_positions on public."jobs";
create trigger jobs_create_initial_positions
  after insert on public."jobs"
  for each row execute procedure public.create_initial_job_positions();

-- ─── 7. Resumo das posições (usado pelas funções) ─────────────────────────────────────
create or replace function public.job_positions_summary(p_job_id text) returns jsonb
language sql stable as $fn$
  select jsonb_build_object(
    'total',     count(*) filter (where "status" <> 'CANCELLED'),
    'filled',    count(*) filter (where "status" = 'FILLED'),
    'open',      count(*) filter (where "status" = 'OPEN'),
    'cancelled', count(*) filter (where "status" = 'CANCELLED'),
    'allFilled', count(*) filter (where "status" <> 'CANCELLED') > 0
                 and count(*) filter (where "status" = 'OPEN') = 0
  )
  from public."job_positions" where "jobId" = p_job_id;
$fn$;

-- ─── 8. Adicionar posição ─────────────────────────────────────────────────────────────
create or replace function public.job_position_add(
  p_job_id        text,
  p_reason        text,
  p_actor_user_id text,
  p_actor_name    text
) returns jsonb
language plpgsql as $fn$
declare
  v_job     public."jobs"%rowtype;
  v_before  int;
  v_number  int;
  v_id      text;
begin
  select * into v_job from public."jobs" where "id" = p_job_id for update;
  if not found then
    raise exception 'Vaga não encontrada.' using errcode = 'P0002';
  end if;
  if v_job."isTalentPool" then
    raise exception 'Banco de talentos não tem posições.' using errcode = 'P0001';
  end if;

  select count(*) filter (where "status" <> 'CANCELLED'), coalesce(max("positionNumber"), 0) + 1
    into v_before, v_number
    from public."job_positions" where "jobId" = p_job_id;

  insert into public."job_positions" ("jobId", "positionNumber")
  values (p_job_id, v_number)
  returning "id" into v_id;

  insert into public."job_events" ("jobId", "positionId", "type", "reason", "data", "actorUserId", "actorName")
  values (p_job_id, v_id, 'POSITION_ADDED', nullif(trim(p_reason), ''),
          jsonb_build_object('number', v_number, 'from', v_before, 'to', v_before + 1),
          p_actor_user_id, coalesce(p_actor_name, 'Sistema'));

  return public.job_positions_summary(p_job_id) || jsonb_build_object('positionId', v_id, 'number', v_number);
end $fn$;

-- ─── 9. Cancelar posição (só em aberto; nunca apaga) ──────────────────────────────────
create or replace function public.job_position_cancel(
  p_position_id   text,
  p_reason        text,
  p_actor_user_id text,
  p_actor_name    text
) returns jsonb
language plpgsql as $fn$
declare
  v_pos    public."job_positions"%rowtype;
  v_active int;
begin
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
  end if;

  select * into v_pos from public."job_positions" where "id" = p_position_id for update;
  if not found then
    raise exception 'Posição não encontrada.' using errcode = 'P0002';
  end if;
  -- Trava a vaga também: dois cancelamentos simultâneos não zeram as posições.
  perform 1 from public."jobs" where "id" = v_pos."jobId" for update;

  if v_pos."status" = 'FILLED' then
    raise exception 'A posição #% está preenchida. Libere a contratação antes de cancelar.',
      lpad(v_pos."positionNumber"::text, 2, '0') using errcode = 'P0001';
  end if;
  if v_pos."status" = 'CANCELLED' then
    raise exception 'A posição #% já está cancelada.', lpad(v_pos."positionNumber"::text, 2, '0')
      using errcode = 'P0001';
  end if;

  select count(*) into v_active
    from public."job_positions" where "jobId" = v_pos."jobId" and "status" <> 'CANCELLED';
  if v_active <= 1 then
    raise exception 'Uma vaga específica precisa de ao menos 1 posição. Para desistir do processo, cancele a vaga.'
      using errcode = 'P0001';
  end if;

  update public."job_positions"
     set "status" = 'CANCELLED', "cancelledAt" = now(),
         "cancelledBy" = coalesce(p_actor_name, 'Sistema'), "cancelReason" = trim(p_reason)
   where "id" = p_position_id;

  insert into public."job_events" ("jobId", "positionId", "type", "reason", "data", "actorUserId", "actorName")
  values (v_pos."jobId", p_position_id, 'POSITION_CANCELLED', trim(p_reason),
          jsonb_build_object('number', v_pos."positionNumber", 'from', v_active, 'to', v_active - 1),
          p_actor_user_id, coalesce(p_actor_name, 'Sistema'));

  return public.job_positions_summary(v_pos."jobId");
end $fn$;

-- ─── 10. Preencher posição (contratação) ──────────────────────────────────────────────
create or replace function public.job_position_fill(
  p_position_id    text,
  p_application_id text,
  p_admission_id   text,
  p_expected_start date,
  p_actor_user_id  text,
  p_actor_name     text
) returns jsonb
language plpgsql as $fn$
declare
  v_pos   public."job_positions"%rowtype;
  v_app   record;
  v_other int;
  v_start date := p_expected_start;
begin
  select * into v_pos from public."job_positions" where "id" = p_position_id for update;
  if not found then
    raise exception 'Posição não encontrada.' using errcode = 'P0002';
  end if;
  if v_pos."status" <> 'OPEN' then
    raise exception 'A posição #% não está em aberto (situação atual: %).',
      lpad(v_pos."positionNumber"::text, 2, '0'),
      case v_pos."status" when 'FILLED' then 'preenchida' else 'cancelada' end
      using errcode = 'P0001';
  end if;

  select "id", "jobId", "fullName" into v_app from public."applications" where "id" = p_application_id;
  if not found then
    raise exception 'Candidatura não encontrada.' using errcode = 'P0002';
  end if;
  if v_app."jobId" <> v_pos."jobId" then
    raise exception 'A candidatura não pertence a esta vaga.' using errcode = 'P0001';
  end if;

  select "positionNumber" into v_other
    from public."job_positions"
   where "jobId" = v_pos."jobId" and "applicationId" = p_application_id and "status" = 'FILLED'
   limit 1;
  if found then
    raise exception '% já ocupa a posição #% desta vaga.', v_app."fullName", lpad(v_other::text, 2, '0')
      using errcode = 'P0001';
  end if;

  if v_start is null and p_admission_id is not null then
    select "startDate" into v_start from public."admissions" where "id" = p_admission_id;
  end if;

  update public."job_positions"
     set "status" = 'FILLED', "applicationId" = p_application_id, "admissionId" = p_admission_id,
         "candidateName" = v_app."fullName", "expectedStartDate" = v_start,
         "filledAt" = now(), "filledBy" = coalesce(p_actor_name, 'Sistema'),
         "cancelledAt" = null, "cancelledBy" = null, "cancelReason" = null
   where "id" = p_position_id;

  insert into public."job_events" ("jobId", "positionId", "type", "data", "actorUserId", "actorName")
  values (v_pos."jobId", p_position_id, 'POSITION_FILLED',
          jsonb_build_object('number', v_pos."positionNumber", 'candidateName', v_app."fullName",
                             'applicationId', p_application_id, 'admissionId', p_admission_id,
                             'expectedStartDate', v_start),
          p_actor_user_id, coalesce(p_actor_name, 'Sistema'));

  return public.job_positions_summary(v_pos."jobId")
         || jsonb_build_object('positionId', p_position_id, 'number', v_pos."positionNumber");
end $fn$;

-- ─── 11. Liberar posição (desistência / contratação cancelada) ────────────────────────
-- A posição volta a ficar em aberto; quem a ocupava fica registrado em job_events.
-- A admissão (se houver) NÃO é apagada aqui — ela segue seu próprio fluxo.
create or replace function public.job_position_release(
  p_position_id   text,
  p_reason        text,
  p_actor_user_id text,
  p_actor_name    text
) returns jsonb
language plpgsql as $fn$
declare
  v_pos public."job_positions"%rowtype;
begin
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Informe o motivo (ex.: desistência do candidato).' using errcode = 'P0001';
  end if;

  select * into v_pos from public."job_positions" where "id" = p_position_id for update;
  if not found then
    raise exception 'Posição não encontrada.' using errcode = 'P0002';
  end if;
  if v_pos."status" <> 'FILLED' then
    raise exception 'Só uma posição preenchida pode ser liberada.' using errcode = 'P0001';
  end if;

  update public."job_positions"
     set "status" = 'OPEN', "applicationId" = null, "admissionId" = null, "candidateName" = null,
         "expectedStartDate" = null, "filledAt" = null, "filledBy" = null
   where "id" = p_position_id;

  insert into public."job_events" ("jobId", "positionId", "type", "reason", "data", "actorUserId", "actorName")
  values (v_pos."jobId", p_position_id, 'POSITION_RELEASED', trim(p_reason),
          jsonb_build_object('number', v_pos."positionNumber", 'candidateName', v_pos."candidateName",
                             'applicationId', v_pos."applicationId", 'admissionId', v_pos."admissionId",
                             'filledAt', v_pos."filledAt"),
          p_actor_user_id, coalesce(p_actor_name, 'Sistema'));

  return public.job_positions_summary(v_pos."jobId");
end $fn$;

revoke all on function public.job_positions_summary(text) from public;
revoke all on function public.job_position_add(text, text, text, text) from public;
revoke all on function public.job_position_cancel(text, text, text, text) from public;
revoke all on function public.job_position_fill(text, text, text, date, text, text) from public;
revoke all on function public.job_position_release(text, text, text, text) from public;
grant execute on function public.job_positions_summary(text) to authenticated, service_role;
grant execute on function public.job_position_add(text, text, text, text) to authenticated, service_role;
grant execute on function public.job_position_cancel(text, text, text, text) to authenticated, service_role;
grant execute on function public.job_position_fill(text, text, text, date, text, text) to authenticated, service_role;
grant execute on function public.job_position_release(text, text, text, text) to authenticated, service_role;

-- ─── 12. Snapshot do escopo aprovado ──────────────────────────────────────────────────
create or replace function public.job_request_scope(r public.job_requests, p_fallback_openings int)
returns jsonb language sql stable as $fn$
  select jsonb_strip_nulls(jsonb_build_object(
    'requestCode',      r.code,
    'title',            r.title,
    'department',       r.department,
    'location',         r.location,
    'openings',         coalesce(r.openings, p_fallback_openings),
    'contractType',     r.contract_type,
    'modality',         r.modality,
    'workSchedule',     r.work_schedule,
    'reasonType',       r.reason_type,
    'requesterName',    r.requester_name,
    'salaryMin',        r.salary_min,
    'salaryMax',        r.salary_max,
    'desiredStartDate', r.desired_start_date,
    'approvedAt',       coalesce(r.approved_at, r.decided_at),
    'approvedBy',       coalesce(r.approved_by_name, r.decided_by),
    'capturedAt',       now()
  ));
$fn$;

-- ─── 13. create_job_from_request: posições + snapshot + evento ────────────────────────
-- Mesma função de antes (20260921120000), com três acréscimos:
--   • openings = quantidade aprovada (mín. 1) → o trigger cria #01..#N;
--   • approvedScope = snapshot do que foi aprovado;
--   • evento JOB_CREATED na linha do tempo da vaga.
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
  v_openings   int;
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

  v_openings := greatest(coalesce(r.openings, 1), 1);

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
    "openings", "responsible", "hiringManager", "requestId", "openingReason",
    "slug", "hiringDeadline", "status", "approvedScope"
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
    v_openings,
    p_actor_name,
    coalesce(r.requester_name, ''),
    r.id,
    r.reason_type,
    v_slug,
    case when r.desired_start_date is not null then r.desired_start_date::timestamptz else null end,
    'DRAFT'::"JobStatus",
    public.job_request_scope(r, v_openings)
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

  insert into public."job_events" ("jobId", "type", "data", "actorUserId", "actorName")
  values (v_job_id, 'JOB_CREATED',
          jsonb_build_object('source', 'request', 'requestId', r.id, 'requestCode', r.code, 'positions', v_openings),
          p_actor_user_id, coalesce(p_actor_name, 'Sistema'));

  return query select v_job_id, v_job_code, r.code;
end $fn$;

comment on function public.create_job_from_request(uuid, text, text, text) is
  'Cria a vaga (com suas posições) a partir de uma solicitação APROVADA, em uma transação. Falha se já houver vaga.';

revoke all on function public.create_job_from_request(uuid, text, text, text) from public;
grant execute on function public.create_job_from_request(uuid, text, text, text) to authenticated, service_role;

-- ─── 14. Backfill das vagas existentes ────────────────────────────────────────────────
-- O backfill não é atividade da vaga: não mexe no updatedAt (usado em "última
-- movimentação" na lista de vagas).
alter table public."jobs" disable trigger set_updatedAt;

-- Snapshot do escopo aprovado para vagas que vieram de solicitação. Solicitações antigas
-- não gravavam a quantidade em coluna: nesse caso vale a quantidade com que a vaga nasceu.
update public."jobs" j
   set "approvedScope" = public.job_request_scope(r, j."openings") || jsonb_build_object('capturedBy', 'migration')
  from public.job_requests r
 where j."requestId" = r.id
   and j."approvedScope" is null;

-- Posições: vaga específica com openings = N ganha #01..#N (openings nulo → 1).
insert into public."job_positions" ("jobId", "positionNumber", "createdAt")
select j."id", n, j."createdAt"
  from public."jobs" j
 cross join lateral generate_series(1, greatest(coalesce(j."openings", 1), 1)) as n
 where not j."isTalentPool"
   and not exists (select 1 from public."job_positions" p where p."jobId" = j."id");

-- Preenchimento inferido: candidaturas em etapa de contratação (WON/ADMISSION), pela ordem
-- em que entraram na etapa, ocupam as posições em ordem — até o limite de posições.
-- Contratados além do número de posições NÃO são vinculados (nada é inventado); ficam
-- no pipeline e podem ser vinculados à mão depois de adicionar a posição.
with hired as (
  select a."id" as app_id, a."jobId", a."fullName",
         coalesce(h."changedAt", a."updatedAt") as hired_at,
         coalesce(h."changedBy", 'Migração') as hired_by,
         row_number() over (partition by a."jobId" order by coalesce(h."changedAt", a."updatedAt"), a."id") as rn
    from public."applications" a
    join public."application_stages" s on s."id" = a."stageId" and s."kind" in ('WON', 'ADMISSION')
    left join lateral (
      select sh."changedAt", sh."changedBy"
        from public."application_stage_history" sh
       where sh."applicationId" = a."id" and sh."stageId" = a."stageId"
       order by sh."changedAt" desc limit 1
    ) h on true
),
adm as (
  select distinct on ("sourceApplicationId") "sourceApplicationId", "id", "startDate"
    from public."admissions"
   where "sourceApplicationId" is not null and "deletedAt" is null
   order by "sourceApplicationId", "createdAt" desc
)
update public."job_positions" p
   set "status" = 'FILLED', "applicationId" = h.app_id, "candidateName" = h."fullName",
       "admissionId" = adm."id", "expectedStartDate" = adm."startDate",
       "filledAt" = h.hired_at, "filledBy" = h.hired_by
  from hired h
  left join adm on adm."sourceApplicationId" = h.app_id
 where p."jobId" = h."jobId"
   and p."positionNumber" = h.rn
   and p."status" = 'OPEN'
   and not exists (
     select 1 from public."job_positions" x
      where x."jobId" = h."jobId" and x."applicationId" = h.app_id and x."status" = 'FILLED'
   );

-- Registra a migração na linha do tempo de cada vaga que ganhou posições.
insert into public."job_events" ("jobId", "type", "data", "actorName", "createdAt")
select p."jobId", 'POSITIONS_MIGRATED',
       jsonb_build_object('positions', count(*), 'filled', count(*) filter (where p."status" = 'FILLED')),
       'Migração', now()
  from public."job_positions" p
 where not exists (select 1 from public."job_events" e where e."jobId" = p."jobId" and e."type" = 'POSITIONS_MIGRATED')
 group by p."jobId";

-- Recalcula openings/openPositions de todas as vagas com posições (o trigger por linha já
-- fez isso, mas garante o estado final mesmo que ele tenha sido desabilitado).
update public."jobs" j
   set "openings" = nullif(c.active, 0), "openPositions" = c.open_count
  from (
    select "jobId",
           count(*) filter (where "status" <> 'CANCELLED')::int as active,
           count(*) filter (where "status" = 'OPEN')::int       as open_count
      from public."job_positions" group by "jobId"
  ) c
 where j."id" = c."jobId"
   and (j."openings" is distinct from nullif(c.active, 0) or j."openPositions" is distinct from c.open_count);

alter table public."jobs" enable trigger set_updatedAt;
