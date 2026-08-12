-- Reestrutura o pipeline padrão de candidatos conforme novo fluxo:
-- Novas candidaturas → Triagem → Teste personalidade → Teste técnico/Excel
-- → Entrevista G&G → Entrevista Gestor → Admissão → Finalizada
-- Etapas ocultas (hideFromBoard = true): Cancelada, Pausada.

-- 1. Nova coluna para ocultar colunas do board principal
ALTER TABLE "application_stages" ADD COLUMN IF NOT EXISTS "hideFromBoard" boolean NOT NULL DEFAULT false;

-- 2. Garante que o check de kind inclui todos os tipos usados
ALTER TABLE "application_stages" DROP CONSTRAINT IF EXISTS application_stages_kind_check;
ALTER TABLE "application_stages" ADD CONSTRAINT application_stages_kind_check
  CHECK (kind IN ('OPEN', 'WON', 'LOST', 'TEST', 'ADMISSION'));

-- 3. Renomeia e reordena etapas existentes para o novo pipeline
UPDATE "application_stages" SET name = 'Novas candidaturas', "sortOrder" = 10 WHERE id = 'NEW';
UPDATE "application_stages" SET name = 'Triagem',            "sortOrder" = 20 WHERE id = 'SCREENING';
UPDATE "application_stages" SET name = 'Entrevista G&G',     "sortOrder" = 50 WHERE id = 'INTERVIEW';
UPDATE "application_stages" SET name = 'Entrevista Gestor',  "sortOrder" = 60 WHERE id = 'OFFER';
UPDATE "application_stages" SET name = 'Finalizada',         "sortOrder" = 80 WHERE id = 'HIRED';
UPDATE "application_stages" SET name = 'Cancelada', "sortOrder" = 90, "hideFromBoard" = true WHERE id = 'REJECTED';

-- 4. Insere novas etapas (ON CONFLICT na coluna unique name garante idempotência)
INSERT INTO "application_stages" (id, name, color, "sortOrder", kind) VALUES
  (gen_random_uuid()::text, 'Teste de personalidade', '#818cf8', 30, 'TEST'),
  (gen_random_uuid()::text, 'Teste técnico/Excel',    '#fb923c', 40, 'TEST'),
  (gen_random_uuid()::text, 'Admissão',               '#34d399', 70, 'ADMISSION'),
  (gen_random_uuid()::text, 'Pausada',                '#94a3b8', 100, 'OPEN')
ON CONFLICT (name) DO NOTHING;

-- 5. Marca a etapa Pausada como oculta do board
UPDATE "application_stages" SET "hideFromBoard" = true WHERE name = 'Pausada';
