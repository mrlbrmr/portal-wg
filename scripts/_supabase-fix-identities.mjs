// Cria a identidade de e-mail (auth.identities) para usuários importados via
// password_hash — sem ela o login por senha do GoTrue pode não encontrar o
// provedor 'email'. Idempotente.
import { Client } from "pg";

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const res = await client.query(
    `insert into auth.identities
       (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
     select
       u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email,
                          'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
     from auth.users u
     where not exists (
       select 1 from auth.identities i
       where i.user_id = u.id and i.provider = 'email'
     )
     returning user_id`
  );
  console.log(`identidades de e-mail criadas: ${res.rowCount}`);
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
