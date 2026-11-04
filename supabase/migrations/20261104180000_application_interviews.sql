-- Agenda de entrevistas: compromissos (data/hora, rodada, local, entrevistador) por candidatura.
-- ADITIVA: só cria tabela, índices, policies e trigger. A rodada é texto livre (1–40), não lista fechada.
-- assessmentId liga o compromisso ao registro de entrevista/parecer (application_assessments) quando existir.

create table if not exists "application_interviews" (
  "id"              text primary key default gen_random_uuid()::text,
  "applicationId"   text        not null references "applications"("id") on delete cascade,
  "round"           text        not null check (char_length("round") between 1 and 40),
  "scheduledAt"     timestamptz not null,
  "durationMin"     integer     not null default 60 check ("durationMin" between 5 and 480),
  "location"        text        check ("location" is null or char_length("location") <= 500),
  "interviewerName" text        check ("interviewerName" is null or char_length("interviewerName") <= 120),
  "notes"           text        check ("notes" is null or char_length("notes") <= 2000),
  "status"          text        not null default 'SCHEDULED'
                                check ("status" in ('SCHEDULED', 'DONE', 'CANCELLED', 'NO_SHOW')),
  "cancelReason"    text        check ("cancelReason" is null or char_length("cancelReason") <= 500),
  "assessmentId"    text        references "application_assessments"("id") on delete set null,
  "createdAt"       timestamptz not null default now(),
  "createdBy"       text,
  "updatedAt"       timestamptz not null default now(),
  "updatedById"     text,
  "updatedByName"   text
);

create index if not exists "application_interviews_app_idx"
  on "application_interviews" ("applicationId", "scheduledAt");
create index if not exists "application_interviews_scheduled_idx"
  on "application_interviews" ("scheduledAt") where "status" = 'SCHEDULED';

create or replace trigger set_updatedAt before update on "application_interviews"
  for each row execute procedure extensions.moddatetime("updatedAt");

-- Candidatura, criação e autor nunca mudam numa edição (quem editou fica em updatedBy*).
create or replace function public.application_interviews_keep_author()
returns trigger language plpgsql as $$
begin
  new."applicationId" := old."applicationId";
  new."createdAt" := old."createdAt";
  new."createdBy" := old."createdBy";
  return new;
end;
$$;

drop trigger if exists application_interviews_keep_author on "application_interviews";
create trigger application_interviews_keep_author before update on "application_interviews"
  for each row execute procedure public.application_interviews_keep_author();

-- RLS: interna (staff lê, admin escreve), sem acesso anon.
alter table "application_interviews" enable row level security;
drop policy if exists "application_interviews_staff_select" on "application_interviews";
create policy "application_interviews_staff_select" on "application_interviews"
  for select to authenticated using (public.is_staff());
drop policy if exists "application_interviews_admin_all" on "application_interviews";
create policy "application_interviews_admin_all" on "application_interviews"
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
