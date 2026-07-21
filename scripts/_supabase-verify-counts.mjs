// Fase 6 — verificação de cutover: compara a contagem de linhas por tabela entre
// Neon (origem) e Supabase (destino) após _supabase-copy-data.mjs.
// Rodar: npx dotenv -e .env.local -- node --use-system-ca scripts/_supabase-verify-counts.mjs
import { Client } from "pg";

const neon = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sb = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

const TABLES = [
  "users", "jobs", "applications", "application_stage_history",
  "job_status_history", "job_publications", "channel_connections", "homepage_config",
  "admission_companies", "admission_branches", "admission_positions", "admission_stages",
  "admission_document_types", "admission_tags", "admission_checklist_templates",
  "admission_template_groups", "admission_template_items", "admissions",
  "admission_checklist_groups", "admission_checklist_items", "admission_checklist_comments",
  "admission_attachments", "admission_activity_log", "admission_notifications",
  "_AdmissionToAdmissionTag",
];

async function count(client, t) {
  try {
    const r = await client.query(`select count(*)::int as n from "${t}"`);
    return r.rows[0].n;
  } catch (e) {
    return `ERRO(${e.code || e.message})`;
  }
}

try {
  await neon.connect();
  await sb.connect();

  let mismatches = 0;
  console.log(`${"tabela".padEnd(34)} ${"neon".padStart(7)} ${"supabase".padStart(9)}   ok`);
  console.log("-".repeat(64));
  for (const t of TABLES) {
    const [n, s] = await Promise.all([count(neon, t), count(sb, t)]);
    const ok = n === s;
    if (!ok) mismatches++;
    console.log(`${t.padEnd(34)} ${String(n).padStart(7)} ${String(s).padStart(9)}   ${ok ? "✓" : "✗ DIVERGE"}`);
  }
  console.log("-".repeat(64));
  console.log(mismatches === 0 ? "✅ todas as contagens batem." : `❌ ${mismatches} tabela(s) divergem.`);
  process.exit(mismatches === 0 ? 0 : 1);
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
} finally {
  await neon.end();
  await sb.end();
}
