-- Migração: CPF como chave de candidato + perfil extraído por IA + status externo do funil
-- Aplicar ANTES do push:
--   SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--     supabase/migrations/20260806120000_cpf_profile_status.sql 20260806120000

-- ───────────────────────────────────────────────────────────────────
-- Features 1 + 2: CPF e perfil de currículo em applications
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS cpf               TEXT,
  ADD COLUMN IF NOT EXISTS cpf_digits        TEXT GENERATED ALWAYS AS
                                               (regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g')) STORED,
  ADD COLUMN IF NOT EXISTS "candidateState"  TEXT,
  ADD COLUMN IF NOT EXISTS cv_profile        JSONB,
  ADD COLUMN IF NOT EXISTS cv_extraction_status TEXT NOT NULL DEFAULT 'PENDING'
                                               CHECK (cv_extraction_status IN ('PENDING','SUCCESS','FAILED','MANUAL_REVIEW'));

-- Índice para lookup por CPF (normalizado)
CREATE INDEX IF NOT EXISTS applications_cpf_digits_idx ON applications (cpf_digits)
  WHERE cpf_digits <> '';

-- ───────────────────────────────────────────────────────────────────
-- Feature 3: label externo por etapa (o que o candidato vê)
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE application_stages
  ADD COLUMN IF NOT EXISTS "externalLabel" TEXT;

-- Seed idempotente — apenas preenche onde está NULL
UPDATE application_stages SET "externalLabel" = 'Candidatura recebida' WHERE id = 'NEW'        AND "externalLabel" IS NULL;
UPDATE application_stages SET "externalLabel" = 'Em análise'           WHERE id = 'SCREENING'  AND "externalLabel" IS NULL;
UPDATE application_stages SET "externalLabel" = 'Entrevista agendada'  WHERE id = 'INTERVIEW'  AND "externalLabel" IS NULL;
UPDATE application_stages SET "externalLabel" = 'Proposta enviada'     WHERE id = 'OFFER'      AND "externalLabel" IS NULL;
UPDATE application_stages SET "externalLabel" = 'Selecionado(a)'       WHERE id = 'HIRED'      AND "externalLabel" IS NULL;
UPDATE application_stages SET "externalLabel" = 'Processo encerrado'   WHERE id = 'REJECTED'   AND "externalLabel" IS NULL;
