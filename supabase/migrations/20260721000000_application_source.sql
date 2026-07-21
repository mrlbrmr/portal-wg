-- Fase 1 (página da vaga) — inserção manual de candidatos/currículos.
--
-- Currículos recebidos por fora do portal (WhatsApp/Catho/Indeed) passam a poder
-- ser cadastrados manualmente pelo RH. Isso exige:
--   • "source"    — origem da candidatura (o portal continua como PORTAL por padrão).
--   • "addedBy"   — quem do RH cadastrou (rastreabilidade LGPD, Art. 37).
--   • "consentAt" nullable — candidato manual NÃO clicou o aceite do portal; a base
--     legal é o envio espontâneo do CV / legítimo interesse do RH, não consentimento.

alter table "applications"
  add column if not exists "source"  text not null default 'PORTAL',
  add column if not exists "addedBy" text;

alter table "applications"
  alter column "consentAt" drop not null;

-- Índice para filtrar/relatar por origem no futuro.
create index if not exists "applications_source_idx" on "applications" ("source");
