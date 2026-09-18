-- ========================================================================================
-- Separação de domínio: SOLICITAÇÃO DE VAGA  ≠  VAGA / PROCESSO SELETIVO
--
-- Antes: `job_requests` era um envelope de formulário (form_data jsonb) com um ciclo de
-- vida raso (RH decide sozinho, sem aprovador, sem histórico, sem identificador humano).
-- A vaga nascia como efeito colateral do JobForm.
--
-- Agora:
--   • a solicitação vira um objeto de gestão com campos estruturados, número (REQ-AAAA-NNNN),
--     fluxo de validação do RH + aprovação, histórico de eventos e passos de aprovação;
--   • a vaga ganha número próprio (VAG-AAAA-NNNN) e só nasce por uma ação explícita
--     ("Criar processo seletivo"), transacional — ver 20260918120001.
--
-- NÃO-DESTRUTIVA: nenhuma coluna é removida. `priority`, `reason` e `form_data` continuam
-- no banco (deprecated / relidos) para não perder o que já foi recebido.
--
-- ⚠ ÚNICO PONTO SENSÍVEL: o enum "JobRequestStatus" é reescrito (SUBMITTED/IN_REVIEW saem).
-- Aplicar junto com o deploy do código novo.
-- ========================================================================================

-- ─── Enums de apoio ────────────────────────────────────────────────────────────────────
do $$ begin
  create type "JobRequestReason" as enum (
    'REPLACEMENT',        -- Substituição
    'HEADCOUNT_INCREASE', -- Aumento de quadro
    'NEW_POSITION',       -- Nova posição
    'TEMPORARY',          -- Temporária
    'OTHER'               -- Outro
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type "BudgetStatus" as enum ('YES', 'NO', 'NOT_APPLICABLE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "ApprovalStepStatus" as enum ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'SKIPPED');
exception when duplicate_object then null; end $$;

-- ─── Numeração humana (REQ-2026-0042 / VAG-2026-0031) ──────────────────────────────────
-- Contador por (escopo, ano). O `on conflict do update ... returning` é atômico: duas
-- inserções simultâneas nunca recebem o mesmo número.
create table if not exists public.code_counters (
  scope text    not null,
  year  integer not null,
  value integer not null default 0,
  primary key (scope, year)
);

create or replace function public.next_entity_code(p_scope text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $fn$
declare
  y integer := extract(year from now() at time zone 'America/Sao_Paulo')::integer;
  n integer;
begin
  insert into public.code_counters (scope, year, value)
  values (p_scope, y, 1)
  on conflict (scope, year) do update set value = public.code_counters.value + 1
  returning value into n;
  return p_prefix || '-' || y::text || '-' || lpad(n::text, 4, '0');
end $fn$;

-- ─── Status: enum novo com o fluxo completo ────────────────────────────────────────────
-- Recria o tipo em vez de usar ALTER TYPE ADD VALUE: assim o mapeamento dos valores
-- antigos acontece na MESMA transação (ADD VALUE não permite usar o valor novo no ato).
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'JobRequestStatus' and e.enumlabel = 'PENDING_HR'
  ) then
    create type "JobRequestStatus_v2" as enum (
      'DRAFT',            -- Rascunho (ainda com o gestor)
      'PENDING_HR',       -- Aguardando validação do RH
      'PENDING_APPROVAL', -- Aguardando aprovação
      'APPROVED',         -- Aprovada — libera "Criar processo seletivo"
      'RETURNED',         -- Devolvida para ajuste
      'REJECTED',         -- Reprovada
      'CANCELLED',        -- Cancelada
      'RECRUITING'        -- Recrutamento iniciado (já existe vaga)
    );

    alter table public.job_requests alter column status drop default;
    alter table public.job_requests
      alter column status type "JobRequestStatus_v2"
      using (
        case
          when status::text in ('SUBMITTED', 'IN_REVIEW') then 'PENDING_HR'
          -- aprovada que já gerou vaga = recrutamento em andamento
          when status::text = 'APPROVED' and job_id is not null then 'RECRUITING'
          else status::text
        end
      )::"JobRequestStatus_v2";

    drop type "JobRequestStatus";
    alter type "JobRequestStatus_v2" rename to "JobRequestStatus";
    alter table public.job_requests alter column status set default 'DRAFT';
  end if;
end $$;

-- ─── Campos estruturados da solicitação ────────────────────────────────────────────────
-- `location` passa a significar Empresa / Unidade (era "Local de trabalho" — a mesma
-- informação na prática); `department` é novo. `reason` (texto do select antigo) vira
-- legado e `reason_type` assume. `priority` fica deprecated: a priorização é externa.
alter table public.job_requests
  add column if not exists code                     text,
  add column if not exists department               text,
  add column if not exists requested_by_user_id     text references public.users (id) on delete set null,
  add column if not exists reason_type              "JobRequestReason",
  add column if not exists replaced_employee        text,
  add column if not exists justification            text,
  add column if not exists contract_type            "ContractType",
  add column if not exists modality                 "Modality",
  add column if not exists work_schedule            text,
  add column if not exists salary_min               numeric(12, 2),
  add column if not exists salary_max               numeric(12, 2),
  add column if not exists cost_center              text,
  add column if not exists budget_status            "BudgetStatus" not null default 'NOT_APPLICABLE',
  add column if not exists extra_data               jsonb not null default '{}'::jsonb,
  add column if not exists submitted_at             timestamptz,
  add column if not exists hr_validated_at          timestamptz,
  add column if not exists hr_validated_by          text,
  add column if not exists current_approver_user_id text references public.users (id) on delete set null,
  add column if not exists approved_at              timestamptz,
  add column if not exists approved_by_user_id      text references public.users (id) on delete set null,
  add column if not exists approved_by_name         text;

comment on column public.job_requests.location   is 'Empresa / Unidade da vaga solicitada.';
comment on column public.job_requests.reason     is 'DEPRECATED — texto livre do motivo (fluxo antigo). Use reason_type.';
comment on column public.job_requests.priority   is 'DEPRECATED — a priorizacao e feita fora do sistema.';
comment on column public.job_requests.extra_data is 'Respostas das perguntas complementares (job_request_form_config).';

-- ─── Papel de aprovador (aditivo: não mexe em is_staff()/is_admin()) ───────────────────
alter table public.users
  add column if not exists "isApprover" boolean not null default false;
comment on column public.users."isApprover" is
  'Pode aprovar/reprovar solicitacoes destinadas a si, independente de UserRole.';

-- ─── Histórico / auditoria da solicitação ──────────────────────────────────────────────
create table if not exists public.job_request_history (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.job_requests (id) on delete cascade,
  event         text not null,              -- CREATED, UPDATED, SUBMITTED, HR_VALIDATED, ...
  from_status   text,
  to_status     text,
  comment       text,
  actor_user_id text references public.users (id) on delete set null,
  actor_name    text,
  created_at    timestamptz not null default now()
);
create index if not exists job_request_history_request_idx
  on public.job_request_history (request_id, created_at);

-- ─── Passos de aprovação ───────────────────────────────────────────────────────────────
-- Uma linha por etapa. A V1 cria um passo só (o aprovador escolhido pelo RH), mas a
-- modelagem já comporta cadeias condicionais (substituição × aumento de quadro × salário
-- acima da faixa) sem mudar o schema: basta inserir vários passos com step_order crescente.
create table if not exists public.job_request_approvals (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references public.job_requests (id) on delete cascade,
  step_order       integer not null default 1,
  rule_key         text,                    -- regra que gerou o passo (ex.: 'DEFAULT', 'BUDGET')
  approver_user_id text references public.users (id) on delete set null,
  approver_name    text,
  status           "ApprovalStepStatus" not null default 'PENDING',
  comment          text,
  decided_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists job_request_approvals_request_idx
  on public.job_request_approvals (request_id, step_order);
create index if not exists job_request_approvals_pending_idx
  on public.job_request_approvals (approver_user_id) where status = 'PENDING';

-- ─── Código humano da vaga ─────────────────────────────────────────────────────────────
alter table public."jobs" add column if not exists "code" text;

-- ─── Backfill ──────────────────────────────────────────────────────────────────────────
-- 1) Campos estruturados a partir do form_data já recebido.
update public.job_requests set
  department        = coalesce(department,        nullif(form_data->>'departamento', '')),
  work_schedule     = coalesce(work_schedule,     nullif(form_data->>'horario', '')),
  justification     = coalesce(justification,     nullif(form_data->>'observacoes', '')),
  replaced_employee = coalesce(replaced_employee, nullif(form_data->>'colaboradorSubstituido', '')),
  cost_center       = coalesce(cost_center,       nullif(form_data->>'centroCusto', ''))
where form_data is not null;

-- 2) reason_type a partir do texto do select antigo.
update public.job_requests set reason_type = (case
  when reason ilike '%substitui%'                               then 'REPLACEMENT'
  when reason ilike '%aumento%' or reason ilike '%expans%'       then 'HEADCOUNT_INCREASE'
  when reason ilike '%nova posi%' or reason ilike '%nova vaga%'  then 'NEW_POSITION'
  when reason ilike '%tempor%'                                   then 'TEMPORARY'
  else 'OTHER'
end)::"JobRequestReason"
where reason_type is null;
update public.job_requests set reason_type = 'OTHER'::"JobRequestReason" where reason_type is null;
alter table public.job_requests alter column reason_type set default 'OTHER';
alter table public.job_requests alter column reason_type set not null;

-- 3) Tipo de contratação a partir do rótulo em português.
update public.job_requests set contract_type = (case
  when form_data->>'tipoContratacao' ilike 'clt%'       then 'CLT'
  when form_data->>'tipoContratacao' ilike 'pj%'        then 'PJ'
  when form_data->>'tipoContratacao' ilike 'est%gio%'   then 'INTERNSHIP'
  when form_data->>'tipoContratacao' ilike '%aprendiz%' then 'APPRENTICE'
  when form_data->>'tipoContratacao' ilike 'tempor%'    then 'TEMPORARY'
  else null
end)::"ContractType"
where contract_type is null and form_data ? 'tipoContratacao';

-- 4) Datas do ciclo antigo (só existem created_at / decided_at).
update public.job_requests set
  submitted_at = coalesce(submitted_at, created_at),
  approved_at  = case when status in ('APPROVED', 'RECRUITING')
                      then coalesce(approved_at, decided_at, created_at) else approved_at end,
  approved_by_name = case when status in ('APPROVED', 'RECRUITING')
                          then coalesce(approved_by_name, decided_by) else approved_by_name end;

-- 5) Números REQ / VAG, em ordem cronológica (determinístico e sem buracos).
do $$
declare r record;
begin
  for r in select id, created_at from public.job_requests where code is null order by created_at, id loop
    update public.job_requests set code = public.next_entity_code('job_request', 'REQ') where id = r.id;
  end loop;
  for r in select "id", "createdAt" from public."jobs" where "code" is null order by "createdAt", "id" loop
    update public."jobs" set "code" = public.next_entity_code('job', 'VAG') where "id" = r."id";
  end loop;
end $$;

create unique index if not exists job_requests_code_key on public.job_requests (code);
create unique index if not exists jobs_code_key         on public."jobs" ("code");

-- 6) Semente de histórico para as solicitações que já existiam.
insert into public.job_request_history (request_id, event, from_status, to_status, comment, actor_name, created_at)
select r.id, 'CREATED', null, 'PENDING_HR',
       'Solicitação recebida pelo formulário (fluxo anterior à reformulação).',
       coalesce(r.requester_name, 'Gestor'), r.created_at
from public.job_requests r
where not exists (select 1 from public.job_request_history h where h.request_id = r.id);

insert into public.job_request_history (request_id, event, from_status, to_status, comment, actor_name, created_at)
select r.id,
       case r.status::text when 'RECRUITING' then 'RECRUITMENT_STARTED' else r.status::text end,
       'PENDING_HR', r.status::text, r.decision_note,
       coalesce(r.decided_by, 'Gente & Gestão'), coalesce(r.decided_at, r.updated_at)
from public.job_requests r
where r.status::text <> 'PENDING_HR'
  and not exists (
    select 1 from public.job_request_history h
    where h.request_id = r.id and h.event <> 'CREATED'
  );

-- ─── Triggers de numeração (novos registros) ───────────────────────────────────────────
create or replace function public.set_job_request_code() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.code is null then new.code := public.next_entity_code('job_request', 'REQ'); end if;
  return new;
end $fn$;
drop trigger if exists job_requests_set_code on public.job_requests;
create trigger job_requests_set_code before insert on public.job_requests
  for each row execute procedure public.set_job_request_code();

create or replace function public.set_job_code() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new."code" is null then new."code" := public.next_entity_code('job', 'VAG'); end if;
  return new;
end $fn$;
drop trigger if exists jobs_set_code on public."jobs";
create trigger jobs_set_code before insert on public."jobs"
  for each row execute procedure public.set_job_code();

drop trigger if exists set_job_requests_updated_at on public.job_requests;
create trigger set_job_requests_updated_at
  before update on public.job_requests
  for each row execute procedure extensions.moddatetime(updated_at);

-- ─── Índices de filtro da listagem ─────────────────────────────────────────────────────
create index if not exists job_requests_requested_by_idx on public.job_requests (requested_by_user_id);
create index if not exists job_requests_approver_idx     on public.job_requests (current_approver_user_id);
create index if not exists job_requests_reason_idx       on public.job_requests (reason_type);
create index if not exists job_requests_department_idx   on public.job_requests (department);
create index if not exists job_requests_location_idx     on public.job_requests (location);
create index if not exists job_requests_desired_date_idx on public.job_requests (desired_start_date);

-- ─── RLS ───────────────────────────────────────────────────────────────────────────────
alter table public.code_counters          enable row level security;
alter table public.job_request_history    enable row level security;
alter table public.job_request_approvals  enable row level security;
-- code_counters fica sem policy: só o service_role e as funções SECURITY DEFINER a tocam.

drop policy if exists jrh_staff_select on public.job_request_history;
create policy jrh_staff_select on public.job_request_history
  for select to authenticated using (public.is_staff());
drop policy if exists jrh_staff_insert on public.job_request_history;
create policy jrh_staff_insert on public.job_request_history
  for insert to authenticated with check (public.is_staff());

drop policy if exists jra_staff_select on public.job_request_approvals;
create policy jra_staff_select on public.job_request_approvals
  for select to authenticated using (public.is_staff());
drop policy if exists jra_admin_all on public.job_request_approvals;
create policy jra_admin_all on public.job_request_approvals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- O aprovador decide o próprio passo mesmo sendo VIEWER_RH.
drop policy if exists jra_approver_update on public.job_request_approvals;
create policy jra_approver_update on public.job_request_approvals
  for update to authenticated
  using (approver_user_id = (auth.jwt() -> 'app_metadata' ->> 'app_user_id'))
  with check (approver_user_id = (auth.jwt() -> 'app_metadata' ->> 'app_user_id'));

-- Mesma ideia na solicitação: quem é o aprovador atual pode decidi-la.
drop policy if exists jr_approver_update on public.job_requests;
create policy jr_approver_update on public.job_requests
  for update to authenticated
  using (current_approver_user_id = (auth.jwt() -> 'app_metadata' ->> 'app_user_id'))
  with check (true);

-- ─── Formulário configurável: vira "perguntas complementares" ──────────────────────────
-- Os campos principais da solicitação passaram a ser estruturados (colunas + zod). O
-- singleton mantém apenas as perguntas EXTRAS que o RH tenha criado no editor; as keys
-- do formulário padrão saem para não duplicarem os campos fixos da tela.
update public.job_request_form_config
set fields = coalesce(
      (select jsonb_agg(e)
         from jsonb_array_elements(fields) e
        where e->>'key' not in (
          'gestor', 'emailGestor', 'funcao', 'quantidade', 'tipoContratacao', 'horario',
          'local', 'motivo', 'colaboradorSubstituido', 'dataDesligamento', 'dataInicio',
          'salarioPretendido', 'perfil', 'observacoes', 'departamento', 'centroCusto'
        )),
      '[]'::jsonb
    ),
    title = 'Solicitação de Vaga | WG Baterias',
    description = 'Preencha sua necessidade de contratação. O time de Gente & Gestão valida a solicitação e encaminha para aprovação — a vaga só é aberta depois disso.',
    updated_at = now()
where id = 'singleton';
