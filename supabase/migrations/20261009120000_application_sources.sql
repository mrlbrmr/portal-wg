-- ========================================================================================
-- ORIGENS DE CANDIDATOS  (Configurações › Cadastros › Origens de candidatos)
--
-- Até aqui a origem do cadastro manual era uma lista fixa no código (WhatsApp, Catho,
-- Indeed, Indicação, Outro). O RH precisa medir de onde os candidatos vêm, então a lista
-- vira cadastro: novas origens são criadas aqui ou direto no modal "Novo candidato".
--
--   • "id" é o CÓDIGO gravado em applications."source" (texto, sem FK — a coluna já existe
--     e guarda também as origens de sistema PORTAL e BANCO_TALENTOS, que NÃO entram aqui).
--     Os códigos antigos são mantidos para o histórico continuar batendo.
--   • Origem em uso nunca é excluída — só desativada (some do modal, continua nos relatórios).
--
-- ADITIVA: tabela nova + função de leitura. O código antigo ignora as duas.
-- ========================================================================================

create table if not exists public."application_sources" (
  "id"        text        primary key,
  "name"      text        not null,
  "active"    boolean     not null default true,
  "sortOrder" integer     not null default 0,
  "createdAt" timestamptz not null default now()
);

create unique index if not exists "application_sources_name_key"
  on public."application_sources" (lower("name"));

alter table public."application_sources" enable row level security;

create policy "application_sources_staff_select" on public."application_sources"
  for select to authenticated using (public.is_staff());

create policy "application_sources_admin_write" on public."application_sources"
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public."application_sources" ("id", "name", "sortOrder") values
  ('WHATSAPP',          'WhatsApp',                 1),
  ('INDEED',            'Indeed',                   2),
  ('CATHO',             'Catho',                    3),
  ('LINKEDIN',          'LinkedIn',                 4),
  ('INFOJOBS',          'InfoJobs',                 5),
  ('INSTAGRAM',         'Instagram',                6),
  ('FACEBOOK',          'Facebook',                 7),
  ('SINE',              'SINE',                     8),
  ('PRESENCIAL',        'Currículo entregue na empresa', 9),
  ('INTERNAL_REFERRAL', 'Indicação',                10),
  ('OTHER',             'Outro',                    11)
on conflict ("id") do nothing;

-- Candidaturas e contratações por origem num período — base do painel "De onde vêm os
-- candidatos". SECURITY INVOKER: respeita o RLS de applications (staff lê).
-- Contratado = candidatura em etapa de contratação (kind WON/ADMISSION), como em job_positions.
create or replace function public.application_source_stats(p_since timestamptz)
returns table ("source" text, "total" bigint, "hired" bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select a."source",
         count(*)                                                 as "total",
         count(*) filter (where s."kind" in ('WON', 'ADMISSION')) as "hired"
    from public."applications" a
    left join public."application_stages" s on s."id" = a."stageId"
   where p_since is null or a."createdAt" >= p_since
   group by a."source"
   order by count(*) desc;
$$;

grant execute on function public.application_source_stats(timestamptz) to authenticated;
