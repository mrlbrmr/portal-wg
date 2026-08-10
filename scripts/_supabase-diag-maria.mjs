// Read-only: confere o candidato manual de teste (source/addedBy/consentAt/resumeUrl).
import { Client } from "pg";
const sb = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await sb.connect();
const r = await sb.query(
  `select id, "fullName", email, source, "addedBy", "consentAt", "resumeUrl", "resumeName", stage from applications where email = 'maria.qa@example.com'`
);
console.log(JSON.stringify(r.rows, null, 2));
await sb.end();
