-- Retenção e anonimização LGPD (migração ADITIVA — segura antes do push).
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--            supabase/migrations/20261111120000_lgpd_retention.sql 20261111120000

-- ─── talentos: marcas de anonimização e bloqueio jurídico ─────────────────────
alter table "talentos"
  add column if not exists "anonimizadoEm"           timestamptz,
  add column if not exists "retencaoBloqueadaEm"     timestamptz,
  add column if not exists "retencaoBloqueioMotivo"  text
    check ("retencaoBloqueioMotivo" is null or char_length("retencaoBloqueioMotivo") <= 500),
  add column if not exists "retencaoBloqueadaPorNome" text;

alter table "applications"
  add column if not exists "anonimizadoEm" timestamptz;

create index if not exists "talentos_anonimizadoEm_idx" on "talentos" ("anonimizadoEm")
  where "anonimizadoEm" is not null;

-- ─── Configuração (linha única) ──────────────────────────────────────────────
create table if not exists "retention_settings" (
  "id"            integer     primary key default 1 check ("id" = 1),
  "months"        integer     not null default 24 check ("months" between 6 and 120),
  "updatedAt"     timestamptz not null default now(),
  "updatedByName" text
);

insert into "retention_settings" ("id") values (1) on conflict do nothing;

alter table "retention_settings" enable row level security;

create policy "retention_settings_staff_select" on "retention_settings"
  for select to authenticated using (public.is_staff());

create policy "retention_settings_admin_update" on "retention_settings"
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
