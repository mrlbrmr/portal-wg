-- Fase 3 (página da vaga) — AVALIAÇÕES do candidato.
--
-- Registros datados de entrevista / teste técnico / teste de personalidade /
-- (futuro) avaliação por IA na ficha do candidato. Etapas (application_stages)
-- marcam a POSIÇÃO no funil; avaliações registram COMO o candidato foi avaliado.
--
-- É o ponto de integração da futura camada AI-native: avaliações com
-- source='AI' (kind='AI_FIT') serão escritas pelo pipeline de IA. Nada de IA aqui.

create table if not exists "application_assessments" (
  "id"             text primary key default gen_random_uuid()::text,
  "applicationId"  text        not null references "applications"("id") on delete cascade,
  "kind"           text        not null,  -- INTERVIEW|TECHNICAL_TEST|PERSONALITY_TEST|AI_FIT|REFERENCE|OTHER
  "source"         text        not null default 'HUMAN',  -- HUMAN | AI
  "title"          text,
  "score"          numeric,               -- normalizado 0..100 (nullable)
  "outcome"        text,                  -- PENDING|PASS|FAIL|RECOMMEND|REJECT (nullable)
  "summary"        text,                  -- parecer / observação
  "evaluator"      text,                  -- nome do RH; p/ IA = "IA · <modelo>"
  "attachmentUrl"  text,                  -- caminho no bucket assessment-files (nullable)
  "attachmentName" text,
  "metadata"       jsonb,                 -- p/ IA: modelo, tokens, versão do prompt
  "occurredAt"     timestamptz,           -- data da entrevista/teste
  "createdBy"      text,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);
create index if not exists "application_assessments_app_idx"
  on "application_assessments" ("applicationId", "occurredAt");

create trigger set_updatedAt before update on "application_assessments"
  for each row execute procedure extensions.moddatetime("updatedAt");

-- Bucket privado para anexos de avaliação (ex.: PDF de resultado de teste).
insert into storage.buckets (id, name, public, file_size_limit)
values ('assessment-files', 'assessment-files', false, 10485760)
on conflict (id) do nothing;

-- RLS: interna (staff lê, admin escreve), sem acesso anon.
alter table "application_assessments" enable row level security;
create policy "application_assessments_staff_select" on "application_assessments"
  for select to authenticated using (public.is_staff());
create policy "application_assessments_admin_all" on "application_assessments"
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
