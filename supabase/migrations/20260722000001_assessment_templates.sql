-- Banco de templates de avaliação (questionários de triagem, testes técnicos, Big Five).
-- Fase 1: somente gestão de templates. O fluxo de sessão/candidato vem na Fase 2.

create table "assessment_templates" (
  "id"           uuid primary key default gen_random_uuid(),
  "name"         text not null,
  "description"  text,
  "kind"         text not null check ("kind" in ('SCREENING', 'TECHNICAL', 'PERSONALITY_BIG5')),
  "subtype"      text,            -- 'PORTUGUESE' | 'EXCEL' | 'CUSTOM' | null
  "estimatedMin" int check ("estimatedMin" > 0),
  "instructions" text,            -- instruções para candidato (usadas na Fase 2)
  "questions"    jsonb not null default '[]',
  "passingScore" numeric check ("passingScore" between 0 and 100),
  "isActive"     boolean not null default true,
  "createdById"  text not null references "users"("id"),
  "createdAt"    timestamptz not null default now(),
  "updatedAt"    timestamptz not null default now()
);

create trigger "assessment_templates_updated_at"
  before update on "assessment_templates"
  for each row execute function set_updated_at();

create index "assessment_templates_kind_idx" on "assessment_templates" ("kind", "isActive");

alter table "assessment_templates" enable row level security;

create policy "templates_staff_select" on "assessment_templates"
  for select to authenticated using (is_staff());

create policy "templates_admin_all" on "assessment_templates"
  for all to authenticated using (is_admin());
