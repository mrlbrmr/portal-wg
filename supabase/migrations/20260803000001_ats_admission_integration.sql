-- Integração ATS → Admissão
-- 1. Adiciona 'ADMISSION' ao kind de application_stages
ALTER TABLE application_stages
  DROP CONSTRAINT IF EXISTS application_stages_kind_check;
ALTER TABLE application_stages
  ADD CONSTRAINT application_stages_kind_check
  CHECK (kind IN ('OPEN','WON','LOST','TEST','ADMISSION'));

-- 2. Ativa FKs nos hooks já existentes
--    ON DELETE SET NULL preserva a admissão mesmo se a candidatura for deletada (LGPD)
ALTER TABLE admissions
  ADD CONSTRAINT admissions_sourceApplicationId_fkey
  FOREIGN KEY ("sourceApplicationId") REFERENCES applications(id) ON DELETE SET NULL;

ALTER TABLE admissions
  ADD CONSTRAINT admissions_sourceJobId_fkey
  FOREIGN KEY ("sourceJobId") REFERENCES jobs(id) ON DELETE SET NULL;

-- 3. Índice para lookup rápido por sourceApplicationId
CREATE INDEX IF NOT EXISTS admissions_sourceApplicationId_idx
  ON admissions ("sourceApplicationId");
