import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await admin.auth.admin.listUsers();
if (error) { console.error("ERRO:", error.message); process.exit(1); }

console.log(`auth.users (${data.users.length}):`);
for (const u of data.users) {
  const m = u.app_metadata ?? {};
  console.log(
    `  • ${u.email}  role=${m.user_role}  app_user_id=${m.app_user_id}  ` +
    `confirmed=${u.email_confirmed_at ? "sim" : "NÃO"}  identities=${(u.identities ?? []).map((i) => i.provider).join(",")}`
  );
}
