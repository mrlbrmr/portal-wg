-- Formulário digital: flag de uniformes operacionais preenchida pelo candidato
alter table "admissions"
  add column if not exists "noOperationalUniform" boolean default false;
