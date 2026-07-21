import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente Supabase server-side (Server Components, Route Handlers, Server
// Actions). Escopado à sessão do usuário via cookies → RLS é a fonte de verdade
// da autorização. Para operações que precisam ignorar RLS (POST público de
// candidatura, feeds, cron/sweeps), use o admin client (service-role).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado de um Server Component (cookies read-only). O refresh da
            // sessão é feito pelo middleware — pode ignorar com segurança.
          }
        },
      },
    }
  );
}
