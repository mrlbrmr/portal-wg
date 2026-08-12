-- Campos legados passam a ser opcionais: o formulário usa apenas "description"
-- como campo unificado. Vagas antigas que ainda têm conteúdo nesses campos
-- continuam funcionando; novas vagas podem omiti-los.
alter table "jobs"
  alter column "responsibilities"     drop not null,
  alter column "requiredRequirements" drop not null;
