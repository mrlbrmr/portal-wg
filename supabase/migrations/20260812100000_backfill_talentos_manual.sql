-- ========================================================================================
-- Backfill: candidatos adicionados manualmente sem vínculo com banco de talentos
--
-- Contexto: a rota /api/vagas/[id]/candidatos (cadastro manual pelo RH) não sincronizava
-- com a tabela 'talentos'. Este script popula retroativamente candidatos manuais sem
-- talentoId, criados após a migração inicial de dados (20260807000001_talentos_datamig).
--
-- Dry-run: BEGIN; <execute este script>; ROLLBACK;
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--            supabase/migrations/20260812100000_backfill_talentos_manual.sql 20260812100000
-- ========================================================================================

DO $$ BEGIN RAISE NOTICE 'Backfill de candidatos manuais no banco de talentos...'; END $$;

-- ─── Passo 1: Inserir talentos para candidaturas manuais sem vínculo ─────────────────
-- Candidaturas manuais: source ∉ {PORTAL, BANCO_TALENTOS}.
-- Por e-mail: pega a candidatura mais recente de cada e-mail como fonte dos dados.
INSERT INTO "talentos" (
  "nomeCompleto", "email", "telefone",
  "curriculoUrl", "curriculoNome",
  "origem", "statusBanco",
  "ultimaAtividadeEm", "createdAt", "updatedAt"
)
SELECT
  "fullName",
  email,
  NULLIF(phone, ''),
  "resumeUrl",
  "resumeName",
  'VAGA_ESPECIFICA',
  'ATIVO',
  GREATEST("updatedAt", "createdAt"),
  "createdAt",
  now()
FROM (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY lower(trim(email)) ORDER BY "createdAt" DESC) AS rn
  FROM "applications"
  WHERE "talentoId" IS NULL
    AND source NOT IN ('PORTAL', 'BANCO_TALENTOS')
    AND email IS NOT NULL AND trim(email) <> ''
) ranked
WHERE rn = 1
ON CONFLICT ("emailNormalizado") DO NOTHING;

-- ─── Passo 2: Vincular talentoId em candidaturas manuais sem vínculo ─────────────────
UPDATE "applications" a
SET "talentoId" = t."id"
FROM "talentos" t
WHERE a."talentoId" IS NULL
  AND a.source NOT IN ('PORTAL', 'BANCO_TALENTOS')
  AND t."emailNormalizado" = lower(trim(a.email));

-- ─── Relatório ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_criados   int;
  n_vinculados int;
  n_pendentes  int;
BEGIN
  SELECT COUNT(*) INTO n_criados
    FROM "talentos"
   WHERE "origem" = 'VAGA_ESPECIFICA'
     AND "consentimentoLgpdEm" IS NULL;

  SELECT COUNT(*) INTO n_vinculados
    FROM "applications"
   WHERE "talentoId" IS NOT NULL
     AND source NOT IN ('PORTAL', 'BANCO_TALENTOS');

  SELECT COUNT(*) INTO n_pendentes
    FROM "applications"
   WHERE "talentoId" IS NULL
     AND source NOT IN ('PORTAL', 'BANCO_TALENTOS');

  RAISE NOTICE '─── Backfill candidatos manuais → talentos ───────────';
  RAISE NOTICE '  Candidaturas manuais vinculadas:   %', n_vinculados;
  RAISE NOTICE '  Candidaturas manuais sem vínculo:  %', n_pendentes;
  RAISE NOTICE '──────────────────────────────────────────────────────';
END $$;
