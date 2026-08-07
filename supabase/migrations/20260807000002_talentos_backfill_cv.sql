-- ========================================================================================
-- Banco de Talentos — Backfill de cargoDesejado, cidade e estado
--
-- Preenche campos NULL dos talentos usando dados já extraídos de suas candidaturas:
--   cargoDesejado ← cv_profile->>'lastPosition'  (IA já extraiu do PDF)
--   cidade        ← candidateCity                (campo do formulário de candidatura)
--   estado        ← candidateState               (campo do formulário de candidatura)
--
-- Só atualiza onde o campo do talento está NULL — nunca sobrescreve dado manual.
-- Fonte: candidatura mais recente de cada talento (ORDER BY createdAt DESC).
--
-- Dry-run: BEGIN; <execute>; ROLLBACK;
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--            supabase/migrations/20260807000002_talentos_backfill_cv.sql 20260807000002
-- ========================================================================================

DO $$ BEGIN RAISE NOTICE 'Início do backfill de CV nos talentos'; END $$;

-- ─── Cargo desejado (via IA) ──────────────────────────────────────────────────────────
UPDATE "talentos" t
SET
  "cargoDesejado" = sub.last_position,
  "updatedAt"     = now()
FROM (
  SELECT DISTINCT ON ("talentoId")
    "talentoId",
    cv_profile->>'lastPosition' AS last_position
  FROM "applications"
  WHERE "talentoId" IS NOT NULL
    AND cv_profile IS NOT NULL
    AND cv_profile->>'lastPosition' IS NOT NULL
    AND cv_profile->>'lastPosition' <> ''
  ORDER BY "talentoId", "createdAt" DESC
) sub
WHERE t.id = sub."talentoId"
  AND (t."cargoDesejado" IS NULL OR t."cargoDesejado" = '');

-- ─── Cidade e estado ─────────────────────────────────────────────────────────────────
UPDATE "talentos" t
SET
  "cidade"    = sub."candidateCity",
  "estado"    = sub."candidateState",
  "updatedAt" = now()
FROM (
  SELECT DISTINCT ON ("talentoId")
    "talentoId",
    "candidateCity",
    "candidateState"
  FROM "applications"
  WHERE "talentoId" IS NOT NULL
    AND ("candidateCity" IS NOT NULL OR "candidateState" IS NOT NULL)
  ORDER BY "talentoId", "createdAt" DESC
) sub
WHERE t.id = sub."talentoId"
  AND t."cidade"  IS NULL
  AND t."estado"  IS NULL;

-- ─── Relatório ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_cargo  int;
  n_local  int;
  n_total  int;
BEGIN
  SELECT COUNT(*) INTO n_total FROM "talentos";
  SELECT COUNT(*) INTO n_cargo FROM "talentos" WHERE "cargoDesejado" IS NOT NULL;
  SELECT COUNT(*) INTO n_local FROM "talentos" WHERE "cidade" IS NOT NULL OR "estado" IS NOT NULL;

  RAISE NOTICE '─── Backfill de CV concluído ─────────────────────────────';
  RAISE NOTICE '  Total de talentos:               %', n_total;
  RAISE NOTICE '  Com cargoDesejado preenchido:    %', n_cargo;
  RAISE NOTICE '  Com cidade/estado preenchido:    %', n_local;
  RAISE NOTICE '──────────────────────────────────────────────────────────';
END $$;
