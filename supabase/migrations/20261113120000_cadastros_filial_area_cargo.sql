-- Filial, área e cargo vindos dos cadastros (spec docs/superpowers/specs/2026-11-13-cadastros-filial-area-cargo-design.md).
--
-- ADITIVA — segura antes do push:
--   1) cadastro novo admission_areas (Configurações › Cadastros › Áreas), com as 7 áreas em uso;
--   2) admission_branches ganha cidade/UF (a vaga nasce com a localização da filial);
--   3) admission_positions ganha usesOperationalUniform / isDriver / isForkliftOperator (o cargo
--      define calça e bota e os documentos de motorista/operador no formulário de admissão);
--   4) job_requests.branch_id/area_id e jobs."branchId"/"areaId" ligam pedido e vaga aos cadastros
--      (as colunas de texto location/department/company continuam sendo gravadas com o nome);
--   5) create_job_from_request() passa filial, área, cidade e UF para a vaga.
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--            supabase/migrations/20261113120000_cadastros_filial_area_cargo.sql 20261113120000

-- ─── 1) Áreas ─────────────────────────────────────────────────────────────────
create table if not exists "admission_areas" (
  "id"        text        primary key default (gen_random_uuid())::text,
  "name"      text        not null,
  "active"    boolean     not null default true,
  "sortOrder" integer     not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

drop trigger if exists set_updatedat on "admission_areas";
create trigger set_updatedat before update on "admission_areas"
  for each row execute function moddatetime('updatedAt');

alter table "admission_areas" enable row level security;
drop policy if exists "admission_areas_staff_select" on "admission_areas";
drop policy if exists "admission_areas_admin_insert" on "admission_areas";
drop policy if exists "admission_areas_admin_update" on "admission_areas";
drop policy if exists "admission_areas_admin_delete" on "admission_areas";
create policy "admission_areas_staff_select" on "admission_areas" for select to authenticated using (public.is_staff());
create policy "admission_areas_admin_insert" on "admission_areas" for insert to authenticated with check ((select public.is_admin()));
create policy "admission_areas_admin_update" on "admission_areas" for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admission_areas_admin_delete" on "admission_areas" for delete to authenticated using ((select public.is_admin()));

insert into "admission_areas" ("name", "sortOrder")
select v.name, v.ord
  from (values ('Logística', 1), ('Comercial', 2), ('Financeiro', 3), ('Administrativo', 4),
               ('Serviços Gerais', 5), ('Varejo', 6), ('Trade', 7)) as v(name, ord)
 where not exists (select 1 from "admission_areas" a where a."name" = v.name);

-- ─── 2) Cidade/UF da filial ──────────────────────────────────────────────────
alter table "admission_branches"
  add column if not exists "city"  text,
  add column if not exists "state" text check ("state" is null or "state" ~ '^[A-Z]{2}$');

update "admission_branches" b
   set "city" = v.city, "state" = v.uf
  from (values ('Matriz (SJP)', 'São José dos Pinhais', 'PR'), ('Rio de Janeiro', 'Nova Iguaçu', 'RJ'),
               ('Maringá', 'Maringá', 'PR'), ('Londrina', 'Londrina', 'PR'),
               ('Sumaré', 'Sumaré', 'SP'), ('São Paulo', 'São Paulo', 'SP')) as v(name, city, uf)
 where b."name" = v.name and b."city" is null;

-- ─── 3) Marcações do cargo ───────────────────────────────────────────────────
alter table "admission_positions"
  add column if not exists "usesOperationalUniform" boolean not null default false,
  add column if not exists "isDriver"               boolean not null default false,
  add column if not exists "isForkliftOperator"     boolean not null default false;

-- Marcações confirmadas pelo usuário em 2026-11-13 (tabela do spec).
update "admission_positions" set "usesOperationalUniform" = true
 where "name" in ('Motorista de Caminhão Junior', 'Motorista de Caminhão Pleno', 'Motorista de Caminhão Senior',
                  'Técnico Entregador', 'Operador Multifuncional', 'Encarregado de Logística',
                  'Auxiliar de Logística', 'Auxiliar de Serviços Gerais');
update "admission_positions" set "isDriver" = true
 where "name" in ('Motorista de Caminhão Junior', 'Motorista de Caminhão Pleno', 'Motorista de Caminhão Senior');
update "admission_positions" set "isForkliftOperator" = true
 where "name" in ('Operador Multifuncional', 'Encarregado de Logística');

-- ─── 4) Pedido e vaga ligados aos cadastros ──────────────────────────────────
alter table "job_requests"
  add column if not exists "branch_id" text references "admission_branches"("id") on delete set null,
  add column if not exists "area_id"   text references "admission_areas"("id") on delete set null;
alter table "jobs"
  add column if not exists "branchId" text references "admission_branches"("id") on delete set null,
  add column if not exists "areaId"   text references "admission_areas"("id") on delete set null;

create index if not exists "job_requests_branch_id_idx" on "job_requests" ("branch_id");
create index if not exists "job_requests_area_id_idx"   on "job_requests" ("area_id");
create index if not exists "jobs_branchId_idx" on "jobs" ("branchId");
create index if not exists "jobs_areaId_idx"   on "jobs" ("areaId");

-- ─── 5) A vaga nasce com filial, área, cidade e UF ───────────────────────────
-- Definição vigente em produção (pg_get_functiondef) com filial/área/cidade/UF no INSERT da vaga.
CREATE OR REPLACE FUNCTION public.create_job_from_request(p_request_id uuid, p_actor_user_id text, p_actor_name text, p_slug_base text)
 RETURNS TABLE(job_id text, job_code text, request_code text)
 LANGUAGE plpgsql
AS $function$
declare
  r            public.job_requests%rowtype;
  v_slug       text;
  v_suffix     int := 1;
  v_job_id     text;
  v_job_code   text;
  v_salary_txt text;
  v_desc       text;
  v_openings   int;
  v_city       text;
  v_state      text;
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

  -- ── Localização vem da filial escolhida na solicitação (cadastro Filiais) ─────────────
  if r.branch_id is not null then
    select b.city, b.state into v_city, v_state
      from public.admission_branches b where b.id = r.branch_id;
  end if;

  -- ── A vaga (sempre Rascunho: publicar é decisão operacional do RH) ──────────────────
  insert into public."jobs" (
    "title", "department", "company", "city", "state", "isTalentPool",
    "modality", "contractType", "description", "workSchedule", "salaryRange",
    "openings", "responsible", "hiringManager", "requestId", "openingReason",
    "slug", "hiringDeadline", "status", "approvedScope", "branchId", "areaId"
  ) values (
    coalesce(nullif(r.title, ''), 'Vaga sem título'),
    r.department,
    r.location,
    v_city, v_state, false,
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
    public.job_request_scope(r, v_openings),
    r.branch_id,
    r.area_id
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
end $function$;
