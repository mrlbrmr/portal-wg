// Read-only: lista buckets do Supabase Storage.
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await sb.storage.listBuckets();
if (error) { console.error("ERRO:", error.message); process.exit(1); }
console.log("buckets:", data.map((b) => `${b.name} (public=${b.public})`).join(", ") || "(nenhum)");
for (const b of ["resumes", "admission-attachments"]) {
  const { data: files, error: e2 } = await sb.storage.from(b).list("", { limit: 5 });
  console.log(`  ${b}: ${e2 ? "ERRO " + e2.message : (files.length + " item(ns) na raiz")}`);
}
