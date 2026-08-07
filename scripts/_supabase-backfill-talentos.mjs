/**
 * Backfill de cargoDesejado / cidade / estado nos talentos.
 *
 * Estratégia (em ordem de prioridade):
 *   cargoDesejado: cv_profile->>'lastPosition'  → título da vaga aplicada
 *   cidade:        applications.candidateCity   (só se preenchido)
 *   estado:        applications.candidateState  (só se preenchido)
 *
 * Uso:
 *   SUPABASE_DB_URL="postgresql://..." node scripts/_supabase-backfill-talentos.mjs
 */

import pg from "pg";

const { Client } = pg;
const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await client.connect();

// ── Diagnóstico ─────────────────────────────────────────────────────────────
console.log("=== Diagnóstico ===");
const { rows: diag } = await client.query(`
  SELECT
    COUNT(*)                                                                  AS total_talentos,
    COUNT(*) FILTER (WHERE t."cargoDesejado" IS NOT NULL)                     AS com_cargo,
    COUNT(*) FILTER (WHERE t."cidade" IS NOT NULL)                            AS com_cidade,
    COUNT(DISTINCT a."talentoId")
      FILTER (WHERE a.cv_profile->>'lastPosition' IS NOT NULL)                AS apps_com_cv_profile,
    COUNT(DISTINCT a."talentoId")
      FILTER (WHERE a."candidateCity" IS NOT NULL)                            AS apps_com_city,
    COUNT(DISTINCT a."talentoId")
      FILTER (WHERE j.title IS NOT NULL)                                      AS apps_com_vaga
  FROM talentos t
  LEFT JOIN applications a ON a."talentoId" = t.id
  LEFT JOIN jobs j         ON j.id = a."jobId"
`);
console.table(diag);

// ── Backfill: cargoDesejado ──────────────────────────────────────────────────
// Prioridade: cv_profile->lastPosition → título da vaga
const cargoResult = await client.query(`
  UPDATE talentos t
  SET
    "cargoDesejado" = COALESCE(sub.last_position, sub.job_title),
    "updatedAt"     = now()
  FROM (
    SELECT DISTINCT ON (a."talentoId")
      a."talentoId",
      a.cv_profile->>'lastPosition' AS last_position,
      j.title                       AS job_title
    FROM applications a
    LEFT JOIN jobs j ON j.id = a."jobId"
    WHERE a."talentoId" IS NOT NULL
    ORDER BY a."talentoId", a."createdAt" DESC
  ) sub
  WHERE t.id = sub."talentoId"
    AND (t."cargoDesejado" IS NULL OR t."cargoDesejado" = '')
    AND (sub.last_position IS NOT NULL OR sub.job_title IS NOT NULL)
  RETURNING t.id
`);
console.log(`\ncargoDesejado atualizado: ${cargoResult.rowCount} talentos`);

// ── Backfill: cidade / estado ────────────────────────────────────────────────
const localResult = await client.query(`
  UPDATE talentos t
  SET
    "cidade"    = sub."candidateCity",
    "estado"    = sub."candidateState",
    "updatedAt" = now()
  FROM (
    SELECT DISTINCT ON (a."talentoId")
      a."talentoId",
      a."candidateCity",
      a."candidateState"
    FROM applications a
    WHERE a."talentoId" IS NOT NULL
      AND (a."candidateCity" IS NOT NULL OR a."candidateState" IS NOT NULL)
    ORDER BY a."talentoId", a."createdAt" DESC
  ) sub
  WHERE t.id = sub."talentoId"
    AND t."cidade" IS NULL
    AND t."estado" IS NULL
  RETURNING t.id
`);
console.log(`cidade/estado atualizado: ${localResult.rowCount} talentos`);

await client.end();
console.log("\nConcluído.");
