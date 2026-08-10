import { Client } from "pg";
const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  const r = await db.query(`select id, "fullName" from applications where email = 'aval.qa@example.com'`);
  const t = r.rows.filter(x => (x.fullName||"").startsWith("Candidato Avaliação QA"));
  if (t.length === 0) { console.log("nada a limpar"); process.exit(0); }
  if (t.length !== r.rows.length) { console.log("ABORT: email fora do alvo"); process.exit(1); }
  for (const x of t) {
    await db.query(`delete from application_assessments where "applicationId" = $1`, [x.id]);
    await db.query(`delete from application_stage_history where "applicationId" = $1`, [x.id]);
    const d = await db.query(`delete from applications where id = $1`, [x.id]);
    console.log("removido:", x.id, d.rowCount);
  }
  console.log("✅ limpo");
} catch(e){ console.error("❌", e.message); process.exit(1); } finally { await db.end(); }
