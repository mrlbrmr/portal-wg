// Reverte os artefatos de validação da Fase 2: volta "Testando" p/ NEW,
// remove a entrada de histórico do move de teste e exclui a etapa "Teste técnico".
import { Client } from "pg";
const APP = "cmrov4tu20001jr04qopulrmf"; // Testando
const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  const st = await db.query(`select id from application_stages where name = 'Teste técnico'`);
  if (st.rows.length === 0) { console.log("Etapa de teste não existe. Nada a reverter."); process.exit(0); }
  const stageId = st.rows[0].id;
  await db.query(`update applications set "stageId" = 'NEW' where id = $1 and "stageId" = $2`, [APP, stageId]);
  const h = await db.query(`delete from application_stage_history where "applicationId" = $1 and "stageId" = $2`, [APP, stageId]);
  console.log("history removidas:", h.rowCount);
  const d = await db.query(`delete from application_stages where id = $1`, [stageId]);
  console.log("etapa 'Teste técnico' removida:", d.rowCount);
  console.log("✅ revertido.");
} catch (e) { console.error("❌", e.message); process.exit(1); } finally { await db.end(); }
