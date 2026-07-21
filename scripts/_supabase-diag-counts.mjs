// Diagnóstico read-only: compara contagens Neon (origem) × Supabase (destino)
// para dimensionar o cutover. Não lê conteúdo de PII, só count(*).
import { Client } from "pg";
const neon = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sb = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const T = ["users", "jobs", "applications", "admissions", "admission_attachments", "job_publications", "channel_connections", "homepage_config"];
await neon.connect();
await sb.connect();
async function c(cl, t) { try { const r = await cl.query(`select count(*)::int n from "${t}"`); return r.rows[0].n; } catch (e) { return "ERR:" + e.message.slice(0, 30); } }
console.log("table".padEnd(26), "neon".padStart(6), "supabase".padStart(10));
for (const t of T) { console.log(t.padEnd(26), String(await c(neon, t)).padStart(6), String(await c(sb, t)).padStart(10)); }
const nr = await neon.query(`select count(*)::int n from applications where "resumeUrl" like 'http%'`);
const na = await neon.query(`select count(*)::int n from admission_attachments where "blobUrl" like 'http%'`);
console.log("\nArquivos Blob a migrar → resumes:", nr.rows[0].n, "| admission-attachments:", na.rows[0].n);
await neon.end();
await sb.end();
