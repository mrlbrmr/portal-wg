// Diagnóstico read-only: no SUPABASE, quantos resumeUrl/blobUrl ainda são URL http
// (arquivo NÃO migrado) vs caminho de objeto (já migrado). Também amostra slugs de
// jobs para confirmar que são dados reais (não seed_*).
import { Client } from "pg";
const sb = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await sb.connect();
const r1 = await sb.query(`select
  count(*) filter (where "resumeUrl" like 'http%')::int as http,
  count(*) filter (where "resumeUrl" is not null and "resumeUrl" not like 'http%')::int as path,
  count(*) filter (where "resumeUrl" is null)::int as nulos
  from applications`);
const r2 = await sb.query(`select
  count(*) filter (where "blobUrl" like 'http%')::int as http,
  count(*) filter (where "blobUrl" is not null and "blobUrl" not like 'http%')::int as path,
  count(*) filter (where "blobUrl" is null)::int as nulos
  from admission_attachments`);
console.log("applications.resumeUrl:", r1.rows[0]);
console.log("admission_attachments.blobUrl:", r2.rows[0]);
const jobs = await sb.query(`select slug, status from jobs order by "createdAt" limit 15`);
console.log("\njobs (slug | status):");
for (const j of jobs.rows) console.log("  ", j.slug, "|", j.status);
const seeds = await sb.query(`select count(*)::int n from jobs where slug like 'seed_%' or slug like '%seed%'`);
console.log("\njobs com 'seed' no slug:", seeds.rows[0].n);
await sb.end();
