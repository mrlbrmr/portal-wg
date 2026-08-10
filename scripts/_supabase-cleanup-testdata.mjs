// Limpeza do dado de teste criado no smoke test do cutover.
// Alvo ESTRITO: applications com email exato do teste E nome começando com "TESTE Cutover QA".
// Passo 1 imprime o que achou; só deleta se bater o alvo. Remove CV do bucket + stage history + application.
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "teste.cutover.qa@example.com";
const TEST_NAME_PREFIX = "TESTE Cutover QA";

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

await db.connect();
try {
  const { rows } = await db.query(
    `select id, "fullName", email, "resumeUrl", "createdAt" from applications where email = $1`,
    [TEST_EMAIL]
  );
  console.log(`Encontrados ${rows.length} registro(s) com email ${TEST_EMAIL}:`);
  for (const r of rows) console.log(`  - ${r.id} | ${r.fullName} | resumeUrl=${r.resumeUrl}`);

  const targets = rows.filter((r) => (r.fullName || "").startsWith(TEST_NAME_PREFIX));
  if (targets.length === 0) { console.log("Nenhum alvo bate o nome de teste. Nada a deletar."); process.exit(0); }
  if (targets.length !== rows.length) { console.log("ABORTADO: há registros com esse email que NÃO são o teste. Revisar manualmente."); process.exit(1); }

  for (const t of targets) {
    // 1. remove CV do bucket resumes (resumeUrl = caminho do objeto)
    if (t.resumeUrl && !t.resumeUrl.startsWith("http")) {
      const { error } = await sb.storage.from("resumes").remove([t.resumeUrl]);
      console.log(`  storage remove ${t.resumeUrl}: ${error ? "ERRO " + error.message : "ok"}`);
    }
    // 2. stage history (FK) e 3. application
    const h = await db.query(`delete from application_stage_history where "applicationId" = $1`, [t.id]);
    console.log(`  stage_history deletadas: ${h.rowCount}`);
    const a = await db.query(`delete from applications where id = $1`, [t.id]);
    console.log(`  application deletada: ${a.rowCount} (${t.id})`);
  }
  console.log("\n✅ limpeza concluída.");
} catch (e) {
  console.error("❌ ERRO:", e.message);
  process.exit(1);
} finally {
  await db.end();
}
