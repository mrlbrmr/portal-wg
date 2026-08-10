// Limpeza do candidato de teste "Maria Teste QA" criado na validação da Fase 1.
// Alvo ESTRITO: email exato + nome começando com "Maria Teste QA".
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const EMAIL = "maria.qa@example.com";
const NAME_PREFIX = "Maria Teste QA";

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
await db.connect();
try {
  const { rows } = await db.query(`select id, "fullName", "resumeUrl" from applications where email = $1`, [EMAIL]);
  const targets = rows.filter((r) => (r.fullName || "").startsWith(NAME_PREFIX));
  if (targets.length === 0) { console.log("Nada a limpar."); process.exit(0); }
  if (targets.length !== rows.length) { console.log("ABORTADO: email com registro fora do alvo."); process.exit(1); }
  for (const t of targets) {
    if (t.resumeUrl && !t.resumeUrl.startsWith("http")) {
      const { error } = await sb.storage.from("resumes").remove([t.resumeUrl]);
      console.log(`storage remove ${t.resumeUrl}: ${error ? "ERRO " + error.message : "ok"}`);
    }
    await db.query(`delete from application_stage_history where "applicationId" = $1`, [t.id]);
    const a = await db.query(`delete from applications where id = $1`, [t.id]);
    console.log(`application deletada: ${a.rowCount} (${t.id})`);
  }
  console.log("✅ limpeza concluída.");
} catch (e) {
  console.error("❌ ERRO:", e.message);
  process.exit(1);
} finally {
  await db.end();
}
