import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase para o browser (Client Components). Usa a anon key — a
// autorização real é feita por RLS (Fase 3). NUNCA use a service_role aqui.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
