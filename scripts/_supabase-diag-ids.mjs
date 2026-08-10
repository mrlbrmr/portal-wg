import { Client } from "pg";
const sb = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await sb.connect();
const app = await sb.query(`select id, "fullName", "stageId" from applications where "jobId" = 'cmrl2yc410000jo0400b9jrxt'`);
const st = await sb.query(`select id, name from application_stages where name = 'Teste técnico'`);
console.log("app:", JSON.stringify(app.rows));
console.log("teste-tecnico stage:", JSON.stringify(st.rows));
await sb.end();
