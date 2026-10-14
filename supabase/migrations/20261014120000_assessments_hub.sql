-- Aba "Avaliações" como hub da candidatura: entrevista + parecer, referências e
-- avaliações externas no MESMO registro (application_assessments), sem tabela paralela.
--
--   INTERVIEW  → entrevista COM o parecer (tipo, data, entrevistador, recomendação e
--                conteúdo rico do editor em JSON). Um registro = uma avaliação.
--   REFERENCE  → referência profissional (empresa, contato, relação, resultado).
--   OTHER      → avaliação externa (título, observações, anexo).
--   AI_FIT     → análise do currículo por IA (inalterado).
--
-- Testes online NÃO são registrados aqui: a fonte de verdade é assessment_sessions.
-- As cópias antigas (metadata.sessionId) ficam no banco, mas a aplicação as ignora.
--
-- Aditiva: só colunas novas + backfill de uma coluna nova. O código antigo segue
-- funcionando durante o build (não lê nem escreve as colunas novas).

alter table "application_assessments"
  add column if not exists "interviewType"         text,
  add column if not exists "recommendation"        text,
  add column if not exists "content"               jsonb,
  add column if not exists "contentText"           text,
  add column if not exists "referenceCompany"      text,
  add column if not exists "referenceContact"      text,
  add column if not exists "referenceRelationship" text,
  add column if not exists "referenceResult"       text,
  -- Sem FK, como application_notes: id da sessão (app_metadata.app_user_id).
  add column if not exists "authorId"              text,
  add column if not exists "updatedById"           text,
  add column if not exists "updatedByName"         text;

alter table "application_assessments"
  drop constraint if exists "application_assessments_recommendation_check",
  add constraint "application_assessments_recommendation_check"
    check ("recommendation" is null or "recommendation" in
      ('UNDEFINED', 'ADVANCE', 'ADVANCE_WITH_CAVEATS', 'TALENT_POOL', 'DO_NOT_ADVANCE')),
  drop constraint if exists "application_assessments_reference_result_check",
  add constraint "application_assessments_reference_result_check"
    check ("referenceResult" is null or "referenceResult" in ('POSITIVE', 'NEUTRAL', 'ATTENTION')),
  drop constraint if exists "application_assessments_interview_type_check",
  add constraint "application_assessments_interview_type_check"
    check ("interviewType" is null or char_length("interviewType") between 1 and 40),
  drop constraint if exists "application_assessments_content_text_check",
  add constraint "application_assessments_content_text_check"
    check ("contentText" is null or char_length("contentText") <= 200000);

create index if not exists "application_assessments_app_kind_idx"
  on "application_assessments" ("applicationId", "kind");

-- Autor, criação e candidatura nunca mudam numa edição (quem editou fica em updatedBy*).
create or replace function public.application_assessments_keep_author()
returns trigger language plpgsql as $$
begin
  new."applicationId" := old."applicationId";
  new."createdAt" := old."createdAt";
  new."createdBy" := old."createdBy";
  new."authorId" := old."authorId";
  return new;
end;
$$;

drop trigger if exists application_assessments_keep_author on "application_assessments";
create trigger application_assessments_keep_author before update on "application_assessments"
  for each row execute procedure public.application_assessments_keep_author();

-- Backfill: entrevistas antigas ganham a recomendação estruturada a partir do resultado.
-- summary/score/outcome antigos ficam como estão (a UI mostra como "registro anterior").
update "application_assessments"
   set "recommendation" = case "outcome"
         when 'RECOMMEND' then 'ADVANCE'
         when 'PASS'      then 'ADVANCE'
         when 'FAIL'      then 'DO_NOT_ADVANCE'
         when 'REJECT'    then 'DO_NOT_ADVANCE'
         else 'UNDEFINED'
       end
 where "kind" = 'INTERVIEW' and "recommendation" is null;
