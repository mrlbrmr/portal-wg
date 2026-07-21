import { Client } from "pg";
const sb = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await sb.connect();

const u = await sb.query(
  `select email, raw_app_meta_data, raw_user_meta_data, is_sso_user, banned_until, deleted_at
     from auth.users order by email`
);
for (const r of u.rows) {
  console.log("email:", r.email);
  console.log("  app_meta :", JSON.stringify(r.raw_app_meta_data));
  console.log("  user_meta:", JSON.stringify(r.raw_user_meta_data));
  console.log("  sso:", r.is_sso_user, " banned:", r.banned_until, " deleted:", r.deleted_at);
}

const i = await sb.query(
  `select u.email, i.provider, i.provider_id, i.identity_data
     from auth.identities i join auth.users u on u.id = i.user_id order by u.email`
);
console.log("\nidentities:");
for (const r of i.rows) {
  console.log(`  ${r.email}  provider=${r.provider}  provider_id=${r.provider_id}  data=${JSON.stringify(r.identity_data)}`);
}
await sb.end();
