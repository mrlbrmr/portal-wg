import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

const JOB_A = "rlstest_active";
const JOB_D = "rlstest_draft";
const APP = "rlstest_app";

function pass(c) { return c ? "✅ PASS" : "❌ FAIL"; }

try {
  await pg.connect();

  // limpa restos de execuções anteriores
  await pg.query(`delete from applications where id = $1`, [APP]);
  await pg.query(`delete from jobs where id = any($1)`, [[JOB_A, JOB_D]]);

  // setup via owner (bypassa RLS)
  await pg.query(
    `insert into jobs (id,title,city,state,modality,description,responsibilities,"requiredRequirements",status)
     values ($1,'RLS Ativa','SP','SP','PRESENTIAL','d','r','req','ACTIVE'),
            ($2,'RLS Rascunho','SP','SP','PRESENTIAL','d','r','req','DRAFT')`,
    [JOB_A, JOB_D]
  );
  await pg.query(
    `insert into applications (id,"jobId","fullName",email,phone,"consentAt")
     values ($1,$2,'Fulano de Teste','t@t.com','11999999999', now())`,
    [APP, JOB_A]
  );

  // ── anon (sem sessão) ──
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const anonJobs = await anon.from("jobs").select("id,status");
  const anonApps = await anon.from("applications").select("id");
  const anonJobIds = (anonJobs.data ?? []).map((r) => r.id);

  console.log("── anon ──");
  console.log(" vê vaga ACTIVE:", pass(anonJobIds.includes(JOB_A)));
  console.log(" NÃO vê vaga DRAFT:", pass(!anonJobIds.includes(JOB_D)));
  console.log(" NÃO vê candidaturas:", pass((anonApps.data ?? []).length === 0), `(rows=${(anonApps.data ?? []).length}, err=${anonApps.error?.code ?? "none"})`);

  // ── admin (logado) ──
  const adm = createClient(URL, ANON, { auth: { persistSession: false } });
  const signin = await adm.auth.signInWithPassword({ email: "murilo.bremer@wgbaterias.com.br", password: "WgTeste#2026" });
  if (signin.error) throw new Error("login admin falhou: " + signin.error.message);
  const admJobs = await adm.from("jobs").select("id");
  const admApps = await adm.from("applications").select("id");
  const admJobIds = (admJobs.data ?? []).map((r) => r.id);

  console.log("── admin (ADMIN_RH) ──");
  console.log(" vê vaga DRAFT:", pass(admJobIds.includes(JOB_D)));
  console.log(" vê candidatura de teste:", pass((admApps.data ?? []).some((r) => r.id === APP)), `(rows=${(admApps.data ?? []).length})`);

  // cleanup
  await pg.query(`delete from applications where id = $1`, [APP]);
  await pg.query(`delete from jobs where id = any($1)`, [[JOB_A, JOB_D]]);
  console.log("\n(dados de teste removidos)");
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
} finally {
  await pg.end();
}
