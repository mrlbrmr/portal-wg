-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — Fase 3 da migração para o Supabase.
--
-- Modelo de autorização (antes em app code, agora no banco):
--   • anon (público) ......... lê vagas em status público + homepage_config.
--                             NUNCA lê candidatos/currículos/admissões.
--   • authenticated (staff) .. lê tudo interno (VIEWER_RH e ADMIN_RH).
--   • ADMIN_RH ............... escreve (insert/update/delete).
--   • service_role (server) .. bypassa RLS — usado no POST público de candidatura,
--                             feeds e cron/sweeps (nunca exposto ao browser).
--
-- Papel vem do JWT: app_metadata.user_role (setado no import de usuários).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Helpers de papel (lêem o claim do JWT) ──────────────────────────────────
create or replace function public.jwt_role() returns text language sql stable as $$
  select auth.jwt() -> 'app_metadata' ->> 'user_role'
$$;
create or replace function public.is_staff() returns boolean language sql stable as $$
  select public.jwt_role() in ('ADMIN_RH', 'VIEWER_RH')
$$;
create or replace function public.is_admin() returns boolean language sql stable as $$
  select public.jwt_role() = 'ADMIN_RH'
$$;
grant execute on function public.jwt_role(), public.is_staff(), public.is_admin() to anon, authenticated;

-- ─── Habilita RLS em TODAS as tabelas públicas (deny-by-default) ──────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ─── Vagas: leitura pública dos status visíveis + staff lê tudo + admin escreve ─
create policy jobs_public_select on public.jobs for select to anon, authenticated
  using (status in ('ACTIVE', 'SCREENING', 'INTERVIEW', 'ADMISSION'));
create policy jobs_staff_select on public.jobs for select to authenticated
  using (public.is_staff());
create policy jobs_admin_all on public.jobs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Homepage config: leitura pública (o portal usa p/ decidir o que mostrar) ──
create policy hc_public_select on public.homepage_config for select to anon, authenticated
  using (true);
create policy hc_admin_all on public.homepage_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Usuários: admin gerencia; cada um lê/edita a própria linha (perfil) ───────
create policy users_admin_all on public.users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy users_self_select on public.users for select to authenticated
  using (id = (auth.jwt() -> 'app_metadata' ->> 'app_user_id'));
create policy users_self_update on public.users for update to authenticated
  using (id = (auth.jwt() -> 'app_metadata' ->> 'app_user_id'))
  with check (id = (auth.jwt() -> 'app_metadata' ->> 'app_user_id'));

-- ─── Conexões de canal (tokens sensíveis): SOMENTE admin ──────────────────────
create policy cc_admin_all on public.channel_connections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Tabelas internas (staff lê, admin escreve) — sem acesso anon ─────────────
do $$
declare
  t text;
  staff_tables text[] := array[
    'applications', 'application_stage_history', 'job_status_history', 'job_publications',
    'admission_companies', 'admission_branches', 'admission_positions', 'admission_stages',
    'admission_document_types', 'admission_tags', 'admission_checklist_templates',
    'admission_template_groups', 'admission_template_items', 'admissions',
    'admission_checklist_groups', 'admission_checklist_items', 'admission_checklist_comments',
    'admission_attachments', 'admission_activity_log', 'admission_notifications',
    '_AdmissionToAdmissionTag'
  ];
begin
  foreach t in array staff_tables loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_staff())',
      t || '_staff_select', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t);
  end loop;
end $$;

-- `sessions` (tabela morta do NextAuth) fica com RLS ligado e SEM policy → nega
-- tudo para anon/authenticated. service_role/owner acessam se necessário.
