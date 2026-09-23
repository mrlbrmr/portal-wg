-- Configurações do painel: registro de alterações + automações das etapas do funil.
--
-- Aditiva: o código antigo não conhece a tabela nem a coluna e segue funcionando.

-- 1. Registro simples de alterações administrativas ──────────────────────────────
-- Quem alterou, quando e em qual módulo das Configurações. Não é versionamento:
-- serve para exibir "Última alteração: Fulano · hoje às 08:14" em cada página.
create table if not exists "config_change_log" (
  "id"        text primary key default gen_random_uuid()::text,
  -- Chave do módulo (ex.: 'funil', 'homepage', 'cadastros.cargos').
  "module"    text        not null check (char_length("module") between 1 and 80),
  "summary"   text        not null check (char_length("summary") between 1 and 300),
  -- Sem FK, como application_notes.authorId: id da sessão (app_metadata.app_user_id).
  "actorId"   text        not null,
  "actorName" text        not null,
  "createdAt" timestamptz not null default now()
);
create index if not exists "config_change_log_module_idx"
  on "config_change_log" ("module", "createdAt" desc);

alter table "config_change_log" enable row level security;

create policy "config_change_log_staff_select" on "config_change_log"
  for select to authenticated using (public.is_staff());

-- Só admin registra, e sempre em nome próprio. Sem update/delete: o log é append-only.
create policy "config_change_log_admin_insert" on "config_change_log"
  for insert to authenticated
  with check (
    public.is_admin()
    and "actorId" = coalesce(auth.jwt() -> 'app_metadata' ->> 'app_user_id', auth.uid()::text)
  );

-- 2. Automações das etapas do funil de seleção ────────────────────────────────────
-- Ações executadas quando um candidato ENTRA na etapa. Hoje:
--   { "openAdmission": bool }   → abre o cadastro da admissão (etapas Admissão/Contratado)
--   { "createTestLink": bool }  → gera o link do teste vinculado (etapas Teste)
-- Chave ausente = comportamento padrão do tipo (ver src/lib/selection-funnel/automations.ts).
alter table "application_stages"
  add column if not exists "automations" jsonb not null default '{}'::jsonb;
