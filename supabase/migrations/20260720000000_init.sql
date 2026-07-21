-- ════════════════════════════════════════════════════════════════════════════
-- Portal de Carreiras — WG Baterias
-- Migration inicial: parity do prisma/schema.prisma (Neon) para Supabase.
--
-- Notas de tradução:
--  • Nomes de tabela = @@map do Prisma; nomes de coluna = campos do Prisma
--    (camelCase, entre aspas) para casar 1:1 com o código do app (supabase-js).
--  • IDs text: default gen_random_uuid()::text — a migração de dados (Fase 6)
--    importa as linhas COM os cuids existentes; o default só vale p/ linhas novas.
--  • updatedAt (@updatedAt) é mantido por trigger moddatetime (o app não seta).
--  • Enums Prisma → tipos ENUM do Postgres.
--  • RLS é habilitado/policiado na Fase 3 (migration separada), NÃO aqui.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "moddatetime" schema extensions;  -- trigger updatedAt
create extension if not exists "pg_trgm";        -- busca por similaridade (Fase 6a)
create extension if not exists "vector";         -- embeddings pgvector (Fase 7)

-- ─── Enums ────────────────────────────────────────────────────────────────────

create type "UserRole"            as enum ('ADMIN_RH', 'VIEWER_RH');
create type "JobStatus"           as enum ('DRAFT', 'ACTIVE', 'SCREENING', 'INTERVIEW', 'ADMISSION', 'PAUSED', 'CLOSED');
create type "Modality"            as enum ('PRESENTIAL', 'REMOTE', 'HYBRID');
create type "ContractType"        as enum ('CLT', 'PJ', 'INTERNSHIP', 'APPRENTICE', 'TEMPORARY', 'OTHER');
create type "JobPriority"         as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
create type "ApplicationStage"    as enum ('NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED');
create type "DistributionChannel" as enum ('MANUAL', 'GOOGLE_JOBS', 'INDEED', 'LINKEDIN_PAGE', 'LINKEDIN_NATIVE');
create type "PublicationStatus"   as enum ('NOT_PUBLISHED', 'PENDING', 'PUBLISHED', 'FAILED', 'REMOVED');
create type "ChecklistItemStatus" as enum ('PENDING', 'IN_PROGRESS', 'DONE', 'NOT_APPLICABLE');

-- ─── Usuários internos (RH) ───────────────────────────────────────────────────
-- Na Fase 2 vira a fonte de dados p/ profiles (Supabase Auth). Mantida aqui p/
-- parity e migração de dados.

create table "users" (
  "id"           text primary key default gen_random_uuid()::text,
  "name"         text        not null,
  "email"        text        not null unique,
  "passwordHash" text        not null,
  "role"         "UserRole"  not null default 'VIEWER_RH',
  "active"       boolean     not null default true,
  "createdAt"    timestamptz not null default now(),
  "updatedAt"    timestamptz not null default now()
);

create table "sessions" (
  "id"           text primary key default gen_random_uuid()::text,
  "sessionToken" text        not null unique,
  "userId"       text        not null,
  "expires"      timestamptz not null,
  "createdAt"    timestamptz not null default now()
);

-- ─── Vagas ────────────────────────────────────────────────────────────────────

create table "jobs" (
  "id"                   text primary key default gen_random_uuid()::text,
  "title"                text           not null,
  "department"           text,
  "company"              text,
  "city"                 text           not null,
  "state"                text           not null,
  "modality"             "Modality"     not null,
  "contractType"         "ContractType" not null default 'CLT',
  "description"          text           not null,
  "responsibilities"     text           not null,
  "requiredRequirements" text           not null,
  "desiredRequirements"  text,
  "benefits"             text,
  "workSchedule"         text,
  "salaryRange"          text,
  "openings"             integer,
  "highlightBenefit"     text,
  "responsible"          text,
  "slug"                 text unique,
  "closingDate"          timestamptz,
  "hiringDeadline"       timestamptz,
  "priority"             "JobPriority"  not null default 'MEDIUM',
  "status"               "JobStatus"    not null default 'ACTIVE',
  "createdAt"            timestamptz    not null default now(),
  "updatedAt"            timestamptz    not null default now()
);

-- ─── Candidaturas ─────────────────────────────────────────────────────────────

create table "applications" (
  "id"         text primary key default gen_random_uuid()::text,
  "jobId"      text               not null references "jobs"("id") on delete cascade,
  "fullName"   text               not null,
  "email"      text               not null,
  "phone"      text               not null,
  "resumeUrl"  text,
  "resumeName" text,
  "stage"      "ApplicationStage" not null default 'NEW',
  "notes"      text,
  "consentAt"  timestamptz        not null,
  "createdAt"  timestamptz        not null default now(),
  "updatedAt"  timestamptz        not null default now()
);
create index "applications_jobId_stage_idx" on "applications" ("jobId", "stage");
create index "applications_createdAt_idx"    on "applications" ("createdAt");

create table "application_stage_history" (
  "id"            text primary key default gen_random_uuid()::text,
  "applicationId" text               not null references "applications"("id") on delete cascade,
  "stage"         "ApplicationStage" not null,
  "changedBy"     text               not null,
  "changedAt"     timestamptz        not null default now()
);

create table "job_status_history" (
  "id"        text primary key default gen_random_uuid()::text,
  "jobId"     text        not null references "jobs"("id") on delete cascade,
  "status"    "JobStatus" not null,
  "changedBy" text        not null,
  "changedAt" timestamptz not null default now()
);

-- ─── Distribuição / divulgação ────────────────────────────────────────────────

create table "job_publications" (
  "id"          text primary key default gen_random_uuid()::text,
  "jobId"       text                  not null references "jobs"("id") on delete cascade,
  "channel"     "DistributionChannel" not null,
  "status"      "PublicationStatus"   not null default 'NOT_PUBLISHED',
  "externalId"  text,
  "externalUrl" text,
  "lastError"   text,
  "postedAt"    timestamptz,
  "createdAt"   timestamptz           not null default now(),
  "updatedAt"   timestamptz           not null default now(),
  unique ("jobId", "channel")
);
create index "job_publications_jobId_idx" on "job_publications" ("jobId");

create table "channel_connections" (
  "id"           text primary key default gen_random_uuid()::text,
  "channel"      "DistributionChannel" not null unique,
  "enabled"      boolean               not null default false,
  "config"       jsonb,
  "accessToken"  text,
  "refreshToken" text,
  "expiresAt"    timestamptz,
  "createdAt"    timestamptz           not null default now(),
  "updatedAt"    timestamptz           not null default now()
);

-- ─── Configurações da Homepage ────────────────────────────────────────────────

create table "homepage_config" (
  "id"                   text primary key,
  "showDepartment"       boolean not null default true,
  "showLocation"         boolean not null default true,
  "showModality"         boolean not null default true,
  "showContractType"     boolean not null default true,
  "showCompany"          boolean not null default false,
  "showWorkSchedule"     boolean not null default false,
  "showSalary"           boolean not null default false,
  "showHighlightBenefit" boolean not null default false,
  "showOpenings"         boolean not null default false,
  "showFilters"          boolean not null default true,
  "showJobCounter"       boolean not null default true,
  "jobsSectionTitle"     text    not null default 'Vagas abertas',
  "jobsSectionSubtitle"  text    not null default 'Encontre a oportunidade ideal para crescer com o Grupo WG.',
  "updatedAt"            timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- ADMISSÕES (onboarding)
-- ════════════════════════════════════════════════════════════════════════════

create table "admission_companies" (
  "id"        text primary key default gen_random_uuid()::text,
  "name"      text        not null unique,
  "active"    boolean     not null default true,
  "sortOrder" integer     not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "admission_branches" (
  "id"        text primary key default gen_random_uuid()::text,
  "name"      text        not null unique,
  "active"    boolean     not null default true,
  "sortOrder" integer     not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "admission_positions" (
  "id"        text primary key default gen_random_uuid()::text,
  "name"      text        not null unique,
  "active"    boolean     not null default true,
  "sortOrder" integer     not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "admission_stages" (
  "id"        text primary key default gen_random_uuid()::text,
  "name"      text        not null unique,
  "color"     text        not null default '#94a3b8',
  "icon"      text,
  "sortOrder" integer     not null default 0,
  "isFinal"   boolean     not null default false,
  "active"    boolean     not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "admission_document_types" (
  "id"        text primary key default gen_random_uuid()::text,
  "name"      text        not null unique,
  "required"  boolean     not null default false,
  "sortOrder" integer     not null default 0,
  "createdAt" timestamptz not null default now()
);

create table "admission_tags" (
  "id"        text primary key default gen_random_uuid()::text,
  "name"      text        not null unique,
  "color"     text        not null default '#64748b',
  "createdAt" timestamptz not null default now()
);

create table "admission_checklist_templates" (
  "id"          text primary key default gen_random_uuid()::text,
  "name"        text        not null,
  "description" text,
  "positionId"  text references "admission_positions"("id") on delete set null,
  "isDefault"   boolean     not null default false,
  "active"      boolean     not null default true,
  "createdById" text,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);

create table "admission_template_groups" (
  "id"         text primary key default gen_random_uuid()::text,
  "templateId" text        not null references "admission_checklist_templates"("id") on delete cascade,
  "name"       text        not null,
  "sortOrder"  integer     not null default 0,
  "createdAt"  timestamptz not null default now()
);

create table "admission_template_items" (
  "id"                   text primary key default gen_random_uuid()::text,
  "groupId"              text        not null references "admission_template_groups"("id") on delete cascade,
  "name"                 text        not null,
  "description"          text,
  "sortOrder"            integer     not null default 0,
  "defaultDaysFromStart" integer,
  "createdAt"            timestamptz not null default now()
);

create table "admissions" (
  "id"                  text primary key default gen_random_uuid()::text,
  "fullName"            text        not null,
  "cpf"                 text,
  "email"               text,
  "phone"               text,
  "birthDate"           date,
  "positionId"          text references "admission_positions"("id") on delete set null,
  "companyId"           text references "admission_companies"("id") on delete set null,
  "branchId"            text references "admission_branches"("id") on delete set null,
  "stageId"             text references "admission_stages"("id") on delete set null,
  "templateId"          text references "admission_checklist_templates"("id") on delete set null,
  "responsibleId"       text,
  "managerName"         text,
  "startDate"           date,
  "medicalExamDate"     date,
  "salary"              numeric(12, 2),
  "shift"               text,
  "uniformSize"         text,
  "uniformShirt"        text,
  "uniformPants"        text,
  "uniformShoe"         text,
  "notes"               text,
  "sourceApplicationId" text,
  "sourceJobId"         text,
  "createdById"         text,
  "updatedById"         text,
  "createdAt"           timestamptz not null default now(),
  "updatedAt"           timestamptz not null default now(),
  "deletedAt"           timestamptz
);
create index "admissions_stageId_idx"    on "admissions" ("stageId");
create index "admissions_createdAt_idx"  on "admissions" ("createdAt" desc);
create index "admissions_startDate_idx"  on "admissions" ("startDate");

create table "admission_checklist_groups" (
  "id"          text primary key default gen_random_uuid()::text,
  "admissionId" text        not null references "admissions"("id") on delete cascade,
  "name"        text        not null,
  "sortOrder"   integer     not null default 0,
  "createdAt"   timestamptz not null default now()
);

create table "admission_checklist_items" (
  "id"            text primary key default gen_random_uuid()::text,
  "groupId"       text                  not null references "admission_checklist_groups"("id") on delete cascade,
  "admissionId"   text                  not null references "admissions"("id") on delete cascade,
  "name"          text                  not null,
  "description"   text,
  "status"        "ChecklistItemStatus" not null default 'PENDING',
  "responsibleId" text,
  "dueDate"       date,
  "completedAt"   timestamptz,
  "completedById" text,
  "sortOrder"     integer               not null default 0,
  "parentId"      text references "admission_checklist_items"("id") on delete cascade,
  "createdAt"     timestamptz           not null default now(),
  "updatedAt"     timestamptz           not null default now()
);
create index "admission_checklist_items_admissionId_idx" on "admission_checklist_items" ("admissionId");
create index "admission_checklist_items_parentId_idx"    on "admission_checklist_items" ("parentId");
create index "admission_checklist_items_dueDate_idx"     on "admission_checklist_items" ("dueDate");

create table "admission_checklist_comments" (
  "id"        text primary key default gen_random_uuid()::text,
  "itemId"    text        not null references "admission_checklist_items"("id") on delete cascade,
  "authorId"  text        not null,
  "body"      text        not null,
  "createdAt" timestamptz not null default now()
);

create table "admission_attachments" (
  "id"             text primary key default gen_random_uuid()::text,
  "admissionId"    text        not null references "admissions"("id") on delete cascade,
  "itemId"         text references "admission_checklist_items"("id") on delete set null,
  "documentTypeId" text references "admission_document_types"("id") on delete set null,
  "fileName"       text        not null,
  "blobUrl"        text        not null,
  "mimeType"       text,
  "sizeBytes"      bigint,
  "uploadedById"   text,
  "createdAt"      timestamptz not null default now()
);
create index "admission_attachments_admissionId_idx" on "admission_attachments" ("admissionId");

create table "admission_activity_log" (
  "id"          bigint generated by default as identity primary key,
  "userId"      text,
  "admissionId" text references "admissions"("id") on delete cascade,
  "entity"      text        not null,
  "entityId"    text,
  "action"      text        not null,
  "description" text,
  "metadata"    jsonb,
  "createdAt"   timestamptz not null default now()
);
create index "admission_activity_log_admissionId_createdAt_idx" on "admission_activity_log" ("admissionId", "createdAt" desc);
create index "admission_activity_log_createdAt_idx"             on "admission_activity_log" ("createdAt" desc);

create table "admission_notifications" (
  "id"          text primary key default gen_random_uuid()::text,
  "userId"      text        not null,
  "admissionId" text references "admissions"("id") on delete cascade,
  "title"       text        not null,
  "body"        text,
  "readAt"      timestamptz,
  "createdAt"   timestamptz not null default now()
);
create index "admission_notifications_userId_readAt_idx" on "admission_notifications" ("userId", "readAt");

-- m2m implícito Admission <-> AdmissionTag (convenção Prisma: _AdmissionToAdmissionTag,
-- coluna A = Admission.id, B = AdmissionTag.id — ordem alfabética dos models).
create table "_AdmissionToAdmissionTag" (
  "A" text not null references "admissions"("id")     on delete cascade,
  "B" text not null references "admission_tags"("id") on delete cascade
);
create unique index "_AdmissionToAdmissionTag_AB_unique" on "_AdmissionToAdmissionTag" ("A", "B");
create index        "_AdmissionToAdmissionTag_B_index"   on "_AdmissionToAdmissionTag" ("B");

-- ─── Triggers de updatedAt (@updatedAt do Prisma) ─────────────────────────────

create trigger set_updatedAt before update on "users"                        for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "jobs"                         for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "applications"                 for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "job_publications"             for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "channel_connections"          for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "homepage_config"              for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "admission_companies"          for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "admission_branches"           for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "admission_positions"          for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "admission_stages"             for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "admission_checklist_templates" for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "admissions"                   for each row execute procedure extensions.moddatetime("updatedAt");
create trigger set_updatedAt before update on "admission_checklist_items"    for each row execute procedure extensions.moddatetime("updatedAt");
