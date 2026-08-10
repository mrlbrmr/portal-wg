// Read-only pós-limpeza (só Supabase): confirma contagem de applications e ausência do teste.
import { Client } from "pg";
const sb = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await sb.connect();
const c = await sb.query(`select count(*)::int n from applications`);
const t = await sb.query(`select count(*)::int n from applications where email like '%cutover%' or "fullName" like 'TESTE%'`);
console.log("applications total no Supabase:", c.rows[0].n);
console.log("registros de teste remanescentes:", t.rows[0].n);
await sb.end();
