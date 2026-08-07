-- ========================================================================================
-- Banco de Talentos — Migração de dados (idempotente)
--
-- Popula 'talentos' a partir de 'applications' sem duplicatas.
-- Chave de dedup: cpf_digits (quando não vazio) → email normalizado (fallback).
--
-- Dry-run: BEGIN; <execute este script>; ROLLBACK;
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--            supabase/migrations/20260807000001_talentos_datamig.sql 20260807000001
-- ========================================================================================

DO $$ BEGIN RAISE NOTICE 'Início da migração de dados de talentos'; END $$;

-- ─── Passo 1: Criar talentos por CPF (candidatura mais recente por CPF) ───────────────
INSERT INTO "talentos" (
  "id", "nomeCompleto", "email", "cpf", "telefone",
  "cidade", "estado", "pretensaoSalarial",
  "curriculoUrl", "curriculoNome",
  "origem", "statusBanco",
  "consentimentoLgpdEm", "ultimaAtividadeEm",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  "fullName", email, cpf, phone,
  "candidateCity", "candidateState",
  "salaryExpectation", "resumeUrl", "resumeName",
  'VAGA_ESPECIFICA', 'ATIVO',
  "consentAt",
  GREATEST("updatedAt", "createdAt"),
  "createdAt", now()
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY cpf_digits ORDER BY "createdAt" DESC) AS rn
  FROM "applications"
  WHERE cpf_digits IS NOT NULL AND cpf_digits <> '' AND "talentoId" IS NULL
) ranked
WHERE rn = 1
ON CONFLICT ("cpfDigits") WHERE "cpfDigits" <> '' DO NOTHING;

-- ─── Passo 2: Vincular candidaturas com CPF aos seus talentos ────────────────────────
UPDATE "applications" a
SET "talentoId" = t."id"
FROM "talentos" t
WHERE a.cpf_digits <> '' AND a.cpf_digits = t."cpfDigits" AND a."talentoId" IS NULL;

-- ─── Passo 3: Criar talentos por e-mail (para candidaturas sem CPF) ──────────────────
-- ON CONFLICT DO NOTHING quando o e-mail já existe (criado via CPF no passo 1).
INSERT INTO "talentos" (
  "id", "nomeCompleto", "email", "cpf", "telefone",
  "cidade", "estado", "pretensaoSalarial",
  "curriculoUrl", "curriculoNome",
  "origem", "statusBanco",
  "consentimentoLgpdEm", "ultimaAtividadeEm",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  "fullName", email, cpf, phone,
  "candidateCity", "candidateState",
  "salaryExpectation", "resumeUrl", "resumeName",
  'VAGA_ESPECIFICA', 'ATIVO',
  "consentAt",
  GREATEST("updatedAt", "createdAt"),
  "createdAt", now()
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY lower(trim(email)) ORDER BY "createdAt" DESC) AS rn
  FROM "applications"
  WHERE "talentoId" IS NULL
) ranked
WHERE rn = 1
ON CONFLICT ("emailNormalizado") DO NOTHING;

-- ─── Passo 4: Vincular candidaturas restantes por e-mail ─────────────────────────────
UPDATE "applications" a
SET "talentoId" = t."id"
FROM "talentos" t
WHERE lower(trim(a.email)) = t."emailNormalizado" AND a."talentoId" IS NULL;

-- ─── Passo 5: Propagar talentoId para sessões de teste existentes ────────────────────
UPDATE "assessment_sessions" s
SET "talentoId" = a."talentoId"
FROM "applications" a
WHERE s."applicationId" = a."id"
  AND a."talentoId" IS NOT NULL
  AND s."talentoId" IS NULL;

-- ─── Passo 6: Calcular validoAte para sessões já concluídas ──────────────────────────
UPDATE "assessment_sessions" s
SET "validoAte" = s."submittedAt" + (at."validityMonths" * INTERVAL '1 month')
FROM "assessment_templates" at
WHERE s."templateId" = at."id"
  AND s."submittedAt" IS NOT NULL
  AND s."validoAte" IS NULL;

-- ─── Relatório ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_talentos    int;
  n_linked      int;
  n_unlinked    int;
  n_sess_linked int;
BEGIN
  SELECT COUNT(*) INTO n_talentos   FROM "talentos";
  SELECT COUNT(*) INTO n_linked     FROM "applications"        WHERE "talentoId" IS NOT NULL;
  SELECT COUNT(*) INTO n_unlinked   FROM "applications"        WHERE "talentoId" IS NULL;
  SELECT COUNT(*) INTO n_sess_linked FROM "assessment_sessions" WHERE "talentoId" IS NOT NULL;

  RAISE NOTICE '─── Migração de talentos concluída ───────────────────';
  RAISE NOTICE '  Talentos no banco:                    %', n_talentos;
  RAISE NOTICE '  Candidaturas vinculadas:              %', n_linked;
  RAISE NOTICE '  Candidaturas SEM vínculo (revisar):   %', n_unlinked;
  RAISE NOTICE '  Sessões de teste vinculadas:          %', n_sess_linked;
  RAISE NOTICE '──────────────────────────────────────────────────────';
END $$;
