// Copia TODOS os dados do Neon → Supabase (mesmo schema/colunas). É o script da
// Fase 6 (cutover), usado desde já para validar a Fase 4 com dados reais.
// Idempotente: trunca tudo (cascade) e recopia na ordem de FKs.
import { Client } from "pg";

const neon = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sb = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

// Ordem de dependência (pais antes de filhos).
const ORDER = [
  "users", "jobs", "applications", "application_stage_history",
  "job_status_history", "job_publications", "channel_connections", "homepage_config",
  "admission_companies", "admission_branches", "admission_positions", "admission_stages",
  "admission_document_types", "admission_tags", "admission_checklist_templates",
  "admission_template_groups", "admission_template_items", "admissions",
  "admission_checklist_groups", "admission_checklist_items", "admission_checklist_comments",
  "admission_attachments", "admission_activity_log", "admission_notifications",
  "_AdmissionToAdmissionTag",
];

function encode(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") return JSON.stringify(v); // jsonb
  return v;
}

async function copyTable(t) {
  const src = await neon.query(`select * from "${t}"`);
  if (src.rows.length === 0) return { table: t, rows: 0 };
  const cols = src.fields.map((f) => f.name);
  const colList = cols.map((c) => `"${c}"`).join(", ");

  // insert multi-linha em 1 statement (FK self-ref checada no fim do statement)
  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < src.rows.length; i += CHUNK) {
    const slice = src.rows.slice(i, i + CHUNK);
    const params = [];
    const tuples = slice.map((row) => {
      const ph = cols.map((c) => {
        params.push(encode(row[c]));
        return `$${params.length}`;
      });
      return `(${ph.join(", ")})`;
    });
    await sb.query(`insert into "${t}" (${colList}) values ${tuples.join(", ")}`, params);
    total += slice.length;
  }
  return { table: t, rows: total };
}

try {
  await neon.connect();
  await sb.connect();

  // trunca tudo (cascade) — reset limpo
  const quoted = ORDER.map((t) => `"${t}"`).join(", ");
  await sb.query(`truncate ${quoted} restart identity cascade`);
  console.log("tabelas truncadas.\n");

  for (const t of ORDER) {
    const r = await copyTable(t);
    console.log(`  ${r.rows.toString().padStart(4)}  ${r.table}`);
  }
  console.log("\n✅ cópia concluída.");
} catch (e) {
  console.error("❌ ERRO:", e.message);
  process.exit(1);
} finally {
  await neon.end();
  await sb.end();
}
