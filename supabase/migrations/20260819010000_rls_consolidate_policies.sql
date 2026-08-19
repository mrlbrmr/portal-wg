-- ─────────────────────────────────────────────────────────────────────────────
-- Performance RLS: elimina "multiple permissive policies" e auth_rls_initplan
-- Identificado via Supabase Database Linter (2026-08-19).
--
-- Problema: cada tabela interna tem 2 policies permissivas para SELECT (role
-- authenticated): _staff_select USING (is_staff()) e _admin_all (FOR ALL)
-- USING (is_admin()). PostgreSQL avalia ambas para cada linha → custo 2×.
-- Em tabelas grandes como applications, somado ao full scan por falta de índice
-- em stageId, isso resulta em queries de 116s no dashboard.
--
-- Fix: dropar _admin_all (FOR ALL → inclui SELECT) e substituir por 3 policies
-- de escrita separadas. A _staff_select já cobre leitura para staff e admin
-- (admin ⊆ staff), então uma única policy de SELECT por tabela é suficiente.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Recria jwt_role() com (select auth.jwt()): garante que auth.jwt() seja
--    executado como initplan (uma vez por statement), nunca por linha.
--    Todas as policies que chamam is_staff() / is_admin() se beneficiam.
create or replace function public.jwt_role() returns text language sql stable as $$
  select (select auth.jwt()) -> 'app_metadata' ->> 'user_role'
$$;

-- 2. Corrige auth_rls_initplan: users_self_select e users_self_update chamavam
--    auth.jwt() sem (select ...), causando re-avaliação por linha.
drop policy if exists users_self_select on public.users;
drop policy if exists users_self_update on public.users;

create policy users_self_select on public.users for select to authenticated
  using (id = (select auth.jwt() -> 'app_metadata' ->> 'app_user_id'));
create policy users_self_update on public.users for update to authenticated
  using (id = (select auth.jwt() -> 'app_metadata' ->> 'app_user_id'))
  with check (id = (select auth.jwt() -> 'app_metadata' ->> 'app_user_id'));

-- 3. Para cada tabela interna com _admin_all (FOR ALL + authenticated):
--    dropa a policy FOR ALL (que adiciona SELECT duplicado sobre _staff_select)
--    e substitui por 3 policies de escrita separadas.
--
--    Excluímos channel_connections (admin-only, sem _staff_select par) e
--    job_stage_config (tem policies com nomes não-padrão e acesso anon).
do $$
declare
  pol record;
  prefix text;
begin
  for pol in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd = 'ALL'
      and 'authenticated' = any(roles)
      and tablename not in ('channel_connections', 'job_stage_config')
    order by tablename
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);

    -- Deriva prefixo: 'applications_admin_all' → 'applications';
    -- 'afc_admin_all' → 'afc'; 'templates_admin_all' → 'templates'
    prefix := regexp_replace(pol.policyname, '_admin_all$', '');

    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))',
      prefix || '_admin_insert', pol.tablename);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      prefix || '_admin_update', pol.tablename);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))',
      prefix || '_admin_delete', pol.tablename);
  end loop;
end $$;

-- 4. users_admin_all foi dropado no loop; ADMIN_RH ainda precisa ler TODOS os
--    usuários (não apenas a própria linha). Policy de SELECT explícita para admin.
--    Resultado: 2 policies SELECT em users (admin_select + self_select), mas a
--    tabela é pequena e isso é inevitável dado o design de "admin lê todos".
create policy users_admin_select on public.users for select to authenticated
  using ((select public.is_admin()));
