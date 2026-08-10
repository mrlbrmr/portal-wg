import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = "murilo.bremer@wgbaterias.com.br";
const authId = "a078f5eb-7b68-4245-96e9-57125233b38b";
const tempPw = "WgTeste#2026";

// 1) define uma senha conhecida no admin
const up = await admin.auth.admin.updateUserById(authId, { password: tempPw });
console.log("updateUserById:", up.error ? `ERRO ${up.error.message}` : "ok");

// 2) tenta logar com ela pelo cliente anon (mesmo caminho do app)
const inSign = await anon.auth.signInWithPassword({ email, password: tempPw });
console.log("signInWithPassword:", inSign.error ? `ERRO ${inSign.error.message}` : `OK (user ${inSign.data.user?.id})`);
if (inSign.data?.session) {
  console.log("  role no JWT app_metadata:", inSign.data.user.app_metadata?.user_role);
}
