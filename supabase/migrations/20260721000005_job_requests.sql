-- Configuração singleton do formulário de abertura de vaga
create table if not exists job_request_form_config (
  id         text primary key,
  title      text not null default '',
  description text not null default '',
  fields     jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table job_request_form_config enable row level security;

create policy "frc_public_select" on public.job_request_form_config
  for select to anon, authenticated using (true);

create policy "frc_admin_all" on public.job_request_form_config
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Solicitações de abertura de vaga recebidas pelo formulário público
create table if not exists job_requests (
  id         uuid primary key default gen_random_uuid(),
  form_data  jsonb not null,
  job_id     uuid references jobs (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table job_requests enable row level security;

create policy "jr_staff_select" on public.job_requests
  for select to authenticated using (public.is_staff());

create policy "jr_admin_all" on public.job_requests
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
