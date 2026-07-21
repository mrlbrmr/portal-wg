-- Fase 2 (página da vaga) — funil de seleção CONFIGURÁVEL.
--
-- Hoje as etapas do Kanban de candidatos são um enum fixo (ApplicationStage:
-- NEW/SCREENING/INTERVIEW/OFFER/HIRED/REJECTED). Passamos para uma tabela de
-- configuração `application_stages` (espelha `admission_stages`), editável pelo RH.
--
-- Estratégia sem downtime: os 6 ids das etapas seed = os próprios valores do enum
-- → o backfill de `stageId` é trivial (stage::text). A coluna enum `stage` fica
-- como espelho legado (o app passa a ler/escrever `stageId`); some num passo futuro.
--
-- `kind` (OPEN|WON|LOST) é a âncora semântica que substitui os hardcodes de
-- métrica: WON = contratado, LOST = reprovado.

create table if not exists "application_stages" (
  "id"        text primary key default gen_random_uuid()::text,
  "name"      text        not null unique,
  "color"     text        not null default '#94a3b8',
  "sortOrder" integer     not null default 0,
  "kind"      text        not null default 'OPEN' check ("kind" in ('OPEN', 'WON', 'LOST')),
  "active"    boolean     not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create trigger set_updatedAt before update on "application_stages"
  for each row execute procedure extensions.moddatetime("updatedAt");

-- Seed = as 6 etapas atuais (ids = valores do enum; cores de src/lib/utils.ts).
insert into "application_stages" ("id", "name", "color", "sortOrder", "kind") values
  ('NEW',       'Novo',       '#60a5fa', 1, 'OPEN'),
  ('SCREENING', 'Triagem',    '#fbbf24', 2, 'OPEN'),
  ('INTERVIEW', 'Entrevista', '#c084fc', 3, 'OPEN'),
  ('OFFER',     'Proposta',   '#22d3ee', 4, 'OPEN'),
  ('HIRED',     'Contratado', '#84cc16', 5, 'WON'),
  ('REJECTED',  'Reprovado',  '#f87171', 6, 'LOST')
on conflict ("id") do nothing;

-- applications: nova FK stageId (backfill do enum), default NEW. A coluna enum
-- `stage` fica intocada (espelho legado, sempre um valor válido; nunca custom).
alter table "applications" add column if not exists "stageId" text;
update "applications" set "stageId" = "stage"::text where "stageId" is null;
alter table "applications" alter column "stageId" set default 'NEW';
alter table "applications" alter column "stageId" set not null;
alter table "applications"
  add constraint "applications_stageId_fkey"
  foreign key ("stageId") references "application_stages"("id") on delete restrict;
create index if not exists "applications_stageId_idx" on "applications" ("jobId", "stageId");

-- histórico: idem. `stage` enum vira nullable (etapas custom não têm valor de enum);
-- o app passa a gravar/ler `stageId`.
alter table "application_stage_history" add column if not exists "stageId" text;
update "application_stage_history" set "stageId" = "stage"::text where "stageId" is null;
alter table "application_stage_history" alter column "stage" drop not null;
alter table "application_stage_history"
  add constraint "ash_stageId_fkey"
  foreign key ("stageId") references "application_stages"("id") on delete restrict;

-- RLS: interna (staff lê, admin escreve), sem acesso anon.
alter table "application_stages" enable row level security;
create policy "application_stages_staff_select" on "application_stages"
  for select to authenticated using (public.is_staff());
create policy "application_stages_admin_all" on "application_stages"
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
