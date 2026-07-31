-- Fase 2 de Avaliações: sessões públicas por token.
-- Cada sessão representa um teste enviado a um candidato específico via link.
-- Espelha o padrão de admissions.digitalFormToken.

create table "assessment_sessions" (
  "id"             uuid        primary key default gen_random_uuid(),
  "applicationId"  text        not null references "applications"("id") on delete cascade,
  "templateId"     uuid        not null references "assessment_templates"("id"),
  "token"          text        not null unique default encode(gen_random_bytes(24), 'hex'),
  "expiresAt"      timestamptz,
  "startedAt"      timestamptz,
  "submittedAt"    timestamptz,
  "answers"        jsonb       not null default '{}',
  "score"          numeric,
  "outcome"        text        check ("outcome" in ('PASS', 'FAIL', 'PENDING_REVIEW')),
  "scoreBreakdown" jsonb,
  "sentBy"         text,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);

create index "assessment_sessions_app_idx" on "assessment_sessions" ("applicationId");

create trigger "assessment_sessions_updated_at"
  before update on "assessment_sessions"
  for each row execute procedure extensions.moddatetime("updatedAt");

alter table "assessment_sessions" enable row level security;

create policy "assessment_sessions_staff_select" on "assessment_sessions"
  for select to authenticated using (is_staff());

create policy "assessment_sessions_admin_all" on "assessment_sessions"
  for all to authenticated using (is_admin());
