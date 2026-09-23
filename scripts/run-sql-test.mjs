// Roda um teste de integração SQL contra o banco SEM deixar rastro:
//   begin; <snapshot pré-migração> ; <migração> ; <teste> ; rollback;
//
//   SUPABASE_DB_URL="..." node scripts/run-sql-test.mjs scripts/test-job-positions.sql [migração.sql]
//
// Sem SUPABASE_DB_URL no ambiente, lê de .env.local. As mensagens `raise notice` do teste
// são impressas; qualquer `raise exception` falha o processo com código 1.
import { Client } from "pg";
import { readFileSync, existsSync } from "node:fs";

function dbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  if (existsSync(".env.local")) {
    const m = readFileSync(".env.local", "utf8").match(/^SUPABASE_DB_URL=(.*)$/m);
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  }
  return null;
}

const url = dbUrl();
if (!url) { console.error("SUPABASE_DB_URL ausente"); process.exit(1); }

const testFile = process.argv[2];
const migrationFile = process.argv[3] ?? null;
if (!testFile) { console.error("uso: node run-sql-test.mjs <teste.sql> [migração.sql]"); process.exit(1); }

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
client.on("notice", (n) => console.log("  ·", n.message));

try {
  await client.connect();
  await client.query("begin");
  // Estado anterior das vagas, para o teste comparar o resultado da migração.
  await client.query(`
    create temp table _pre_openings on commit drop as
    select j.id, j.openings, j."isTalentPool" as tp, j."updatedAt" as updated,
           (select count(*) from public.applications a where a."jobId" = j.id) as apps
      from public.jobs j`);
  await client.query("select set_config('test.with_migration', $1, true)", [migrationFile ? "on" : "off"]);
  if (migrationFile) await client.query(readFileSync(migrationFile, "utf8"));
  await client.query(readFileSync(testFile, "utf8"));
  console.log("✅ todos os cenários passaram (transação desfeita — nada foi gravado)");
} catch (e) {
  console.error("❌ FALHOU:", e.message);
  process.exitCode = 1;
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
