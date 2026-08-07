-- ========================================================================================
-- Adiciona isFinal a admission_stages
-- Marca etapas terminais (admissão concluída) para separar da contagem de "ativas".
-- Migração aditiva — não quebra nada.
-- ========================================================================================

ALTER TABLE "admission_stages"
  ADD COLUMN IF NOT EXISTS "isFinal" boolean NOT NULL DEFAULT false;

-- Marca automaticamente etapas cujo nome indica conclusão.
-- Ajuste manual via Supabase Dashboard se necessário para outros nomes.
UPDATE "admission_stages"
SET "isFinal" = true
WHERE
  name ILIKE '%concluída%'
  OR name ILIKE '%concluida%'
  OR name ILIKE '%finalizada%'
  OR name ILIKE '%finalizado%'
  OR name ILIKE '%completa%';
