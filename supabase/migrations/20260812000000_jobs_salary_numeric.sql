-- Adiciona campo de salário fixo (numérico) à tabela de vagas.
-- Substitui o campo textual "salaryRange" para vagas com valor definido.
-- salaryRange permanece para retrocompatibilidade (vagas antigas).
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "salary" numeric(12, 2);
