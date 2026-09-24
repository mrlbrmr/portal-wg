-- ========================================================================================
-- ONDE A VAGA APARECE  (Portal de Carreiras · Intranet WG Conecta)
--
-- A tabela jobs passa a ser a ÚNICA fonte de vagas do ecossistema WG. A Intranet deixa de
-- ter cadastro próprio e lê as vagas daqui por GET /api/intranet/jobs (servidor a
-- servidor, com token). Esta coluna decide em qual das duas vitrines cada vaga aparece:
--
--   BOTH     → Portal de Carreiras + Intranet (padrão)
--   PUBLIC   → só no Portal de Carreiras
--   INTERNAL → só na Intranet. Fica FORA da lista pública, do sitemap e dos feeds
--              (Google/Indeed), mas a página /vagas/[slug] continua abrindo pelo link
--              direto (noindex) — é nela que o colaborador envia a candidatura.
--
-- Status continua mandando: a vaga só aparece em qualquer vitrine se estiver aberta
-- (ACTIVE/SCREENING/INTERVIEW/ADMISSION) e com as inscrições no prazo.
--
-- ADITIVA: vagas existentes ficam BOTH — nada some do portal. O código antigo ignora a
-- coluna e segue funcionando durante o build.
-- ========================================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'JobVisibility') then
    create type "JobVisibility" as enum ('BOTH', 'PUBLIC', 'INTERNAL');
  end if;
end $$;

alter table public."jobs"
  add column if not exists "visibility" "JobVisibility" not null default 'BOTH';

comment on column public."jobs"."visibility" is
  'Onde a vaga aparece: BOTH (Portal + Intranet), PUBLIC (só Portal), INTERNAL (só Intranet; fora da lista pública, sitemap e feeds).';
