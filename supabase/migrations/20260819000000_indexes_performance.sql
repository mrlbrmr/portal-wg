-- ─────────────────────────────────────────────────────────────────────────────
-- Índices de performance — identificados via slow-query log Vercel (2026-08-19)
-- ─────────────────────────────────────────────────────────────────────────────

-- O índice composto (jobId, stageId) não serve para queries que filtram APENAS
-- por stageId (ex.: dashboard "newAppsByJob", count de novas candidaturas).
-- PostgreSQL faz full table scan nesse caso, avaliando RLS por linha → 100s+.
create index if not exists "applications_stageId_only_idx"
  on "applications" ("stageId");

-- updatedAt: usado em vagas/gerenciar para ordenar por última atividade.
create index if not exists "applications_updatedAt_idx"
  on "applications" ("updatedAt");
