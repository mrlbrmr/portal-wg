-- Sessões do bot de admissão digital via WhatsApp
create table "whatsapp_admission_sessions" (
  "id"          text        primary key default gen_random_uuid()::text,
  "admissionId" text        references "admissions"("id") on delete set null,
  "phone"       text        not null,
  "state"       text        not null default 'WAITING_START',
  "data"        jsonb       not null default '{}',
  "provider"    text        not null default 'zapi',
  "retryCount"  integer     not null default 0,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now(),
  "expiresAt"   timestamptz not null default (now() + interval '72 hours')
);
create index "whatsapp_sessions_phone_idx"       on "whatsapp_admission_sessions" ("phone");
create index "whatsapp_sessions_admissionId_idx" on "whatsapp_admission_sessions" ("admissionId");
create index "whatsapp_sessions_expiresAt_idx"   on "whatsapp_admission_sessions" ("expiresAt");

create trigger set_updatedAt before update on "whatsapp_admission_sessions"
  for each row execute procedure extensions.moddatetime("updatedAt");

alter table "whatsapp_admission_sessions" enable row level security;

create policy "was_staff_select" on "whatsapp_admission_sessions"
  for select to authenticated using (public.is_staff());

create policy "was_admin_all" on "whatsapp_admission_sessions"
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Log de mensagens trocadas (inbound e outbound) — para auditoria e debug
create table "whatsapp_messages" (
  "id"                  text        primary key default gen_random_uuid()::text,
  "sessionId"           text        not null references "whatsapp_admission_sessions"("id") on delete cascade,
  "direction"           text        not null,  -- INBOUND | OUTBOUND
  "messageType"         text        not null,  -- text | image | document | audio | video | unknown
  "content"             text,
  "mediaUrl"            text,
  "providerMessageId"   text,
  "sentAt"              timestamptz not null default now()
);
create index "whatsapp_messages_sessionId_idx" on "whatsapp_messages" ("sessionId");

alter table "whatsapp_messages" enable row level security;

create policy "wm_staff_select" on "whatsapp_messages"
  for select to authenticated using (public.is_staff());

create policy "wm_admin_all" on "whatsapp_messages"
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Colunas de IA e rastreamento WhatsApp em admission_attachments
alter table "admission_attachments"
  add column if not exists "aiValidationStatus" text        not null default 'PENDING',
  add column if not exists "aiExtractedData"    jsonb,
  add column if not exists "aiModel"            text,
  add column if not exists "aiValidatedAt"      timestamptz,
  add column if not exists "whatsappSessionId"  text
    references "whatsapp_admission_sessions"("id") on delete set null;
