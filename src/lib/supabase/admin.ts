import { createClient } from "@supabase/supabase-js";

// Cliente Supabase com a SERVICE_ROLE key — **bypassa RLS**. Uso restrito a
// caminhos server-side onde a autorização já foi verificada em app code ou não
// há usuário logado por design:
//   • POST público de candidatura (/api/applications) — anon insere via server;
//   • feeds (Google/Indeed) e cron/sweeps de IA;
//   • operações administrativas server-only.
// NUNCA exponha este cliente ao browser nem importe em Client Components.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
