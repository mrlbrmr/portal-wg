-- Banco de Talentos: coluna isTalentPool + city/state passam a ser opcionais
alter table "jobs"
  add column if not exists "isTalentPool" boolean not null default false;

alter table "jobs"
  alter column "city"  drop not null,
  alter column "state" drop not null;
