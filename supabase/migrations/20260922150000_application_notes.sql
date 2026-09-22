-- Anotações da equipe por candidatura, com autor e data (aba "Anotações" do Quick View).
--
-- Antes havia UM campo de texto por candidatura (applications.notes), sem autor nem data.
-- Ele continua existindo e em uso (o motivo da reprovação é anexado lá); a UI o mostra
-- como "Anotações anteriores". As notas novas vão para esta tabela.
--
-- Aditiva: o código antigo não conhece a tabela e segue funcionando.

create table if not exists "application_notes" (
  "id"            text primary key default gen_random_uuid()::text,
  "applicationId" text        not null references "applications"("id") on delete cascade,
  "body"          text        not null check (char_length("body") between 1 and 5000),
  -- Sem FK, como createdById/reviewedById: id da sessão (app_metadata.app_user_id).
  "authorId"      text        not null,
  "authorName"    text        not null,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);
create index if not exists "application_notes_app_idx"
  on "application_notes" ("applicationId", "createdAt" desc);

create trigger set_updatedAt before update on "application_notes"
  for each row execute procedure extensions.moddatetime("updatedAt");

-- RLS: staff lê; admin cria em nome próprio; só o autor (admin) edita ou exclui.
alter table "application_notes" enable row level security;

create policy "application_notes_staff_select" on "application_notes"
  for select to authenticated using (public.is_staff());

create policy "application_notes_admin_insert" on "application_notes"
  for insert to authenticated
  with check (
    public.is_admin()
    and "authorId" = coalesce(auth.jwt() -> 'app_metadata' ->> 'app_user_id', auth.uid()::text)
  );

create policy "application_notes_author_update" on "application_notes"
  for update to authenticated
  using (
    public.is_admin()
    and "authorId" = coalesce(auth.jwt() -> 'app_metadata' ->> 'app_user_id', auth.uid()::text)
  )
  with check (
    public.is_admin()
    and "authorId" = coalesce(auth.jwt() -> 'app_metadata' ->> 'app_user_id', auth.uid()::text)
  );

create policy "application_notes_author_delete" on "application_notes"
  for delete to authenticated
  using (
    public.is_admin()
    and "authorId" = coalesce(auth.jwt() -> 'app_metadata' ->> 'app_user_id', auth.uid()::text)
  );
