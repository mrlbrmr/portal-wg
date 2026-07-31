-- Campos adicionais do formulário de candidatura pública.
-- Adicionados de forma aditiva (sem breaking change no código existente).
alter table "applications"
  add column if not exists "country"             text,
  add column if not exists "candidateCity"       text,
  add column if not exists "availablePresential" boolean,
  add column if not exists "salaryExpectation"   numeric(12, 2);
