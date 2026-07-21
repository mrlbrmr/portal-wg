// Importa os usuários RH do Neon para o Supabase:
//  1. tabela public.users (preserva o id cuid — usado como texto em changedBy,
//     responsibleId, createdById, uploadedById, etc.);
//  2. auth.users (Supabase Auth) com o hash bcrypt existente (login transparente,
//     sem reset). Papel e id-do-app vão em app_metadata → entram no JWT p/ RLS.
//
// Rodar: node --use-system-ca scripts/_supabase-import-users.mjs
// (--use-system-ca faz o Node confiar na CA do Avast p/ o HTTPS do Supabase Auth)

import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const NEON = process.env.DATABASE_URL;
const SB_DB = process.env.SUPABASE_DB_URL;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!NEON || !SB_DB || !SB_URL || !SB_SERVICE) {
  console.error("Faltam env: DATABASE_URL, SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const neon = new Client({ connectionString: NEON, ssl: { rejectUnauthorized: false } });
const sbdb = new Client({ connectionString: SB_DB, ssl: { rejectUnauthorized: false } });
const admin = createClient(SB_URL, SB_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

try {
  await neon.connect();
  await sbdb.connect();

  const { rows: users } = await neon.query(
    `select id, name, email, "passwordHash", role, active, "createdAt", "updatedAt"
       from users order by "createdAt"`
  );

  console.log(`\n=== Usuários no Neon (${users.length}) ===`);
  for (const u of users) {
    console.log(`  • ${u.name}  <${u.email}>  [${u.role}]  ${u.active ? "ativo" : "INATIVO"}`);
  }
  console.log("");

  for (const u of users) {
    // 1) public.users (upsert, preserva id cuid)
    await sbdb.query(
      `insert into users (id, name, email, "passwordHash", role, active, "createdAt", "updatedAt")
       values ($1,$2,$3,$4,$5::"UserRole",$6,$7,$8)
       on conflict (id) do update set
         name = excluded.name, email = excluded.email,
         "passwordHash" = excluded."passwordHash", role = excluded.role,
         active = excluded.active`,
      [u.id, u.name, u.email, u.passwordHash, u.role, u.active, u.createdAt, u.updatedAt]
    );

    // 2) auth.users via Admin API (password_hash = bcrypt existente)
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password_hash: u.passwordHash,
      email_confirm: true,
      user_metadata: { name: u.name },
      app_metadata: { user_role: u.role, app_user_id: u.id },
    });

    if (error) {
      if (/already been registered|already exists|duplicate/i.test(error.message)) {
        console.log(`  ↺ auth já existia: ${u.email}`);
      } else {
        console.error(`  ✗ auth ERRO ${u.email}: ${error.message}`);
      }
    } else {
      console.log(`  ✓ importado: ${u.email}  (auth id ${data.user.id})`);
    }
  }

  console.log("\nConcluído.");
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
} finally {
  await neon.end();
  await sbdb.end();
}
