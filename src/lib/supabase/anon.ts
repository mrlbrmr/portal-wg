import { createClient } from "@supabase/supabase-js";

// Cliente Supabase anônimo, SEM cookies — para páginas/rotas PÚBLICAS (homepage,
// detalhe de vaga, sitemap, feeds). Como não lê a sessão, não chama cookies() e
// portanto não força renderização dinâmica (preserva ISR/estático). O RLS aplica
// as policies de `anon` (somente vagas em status público).
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
