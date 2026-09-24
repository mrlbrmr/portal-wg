-- ========================================================================================
-- Etapa de recebimento dos documentos (admission_stages."isDocumentIntake")
-- Quando o candidato começa a enviar documentos pelo formulário digital (ou envia tudo),
-- a admissão avança sozinha para esta etapa — só para frente, nunca volta.
-- No máximo UMA etapa marcada (índice único parcial). Migração aditiva.
-- ========================================================================================

ALTER TABLE "admission_stages"
  ADD COLUMN IF NOT EXISTS "isDocumentIntake" boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "admission_stages_single_document_intake"
  ON "admission_stages" ((true))
  WHERE "isDocumentIntake";

-- Liga a automação na etapa atual "Validação de documentos" (se existir).
UPDATE "admission_stages"
SET "isDocumentIntake" = true
WHERE id = (
  SELECT id FROM "admission_stages"
  WHERE name ILIKE 'valida%o de documentos'
  ORDER BY "sortOrder"
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "admission_stages" WHERE "isDocumentIntake");
