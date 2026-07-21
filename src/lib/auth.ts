import { createClient } from "@/lib/supabase/server";

// Autenticação via Supabase Auth (substitui o NextAuth).
//
// O formato de `Session`/`auth()` é mantido idêntico ao que o app já consumia
// (`session.user.{id,name,email,role}`) para não tocar nas dezenas de rotas e
// server components que dependem dele.
//
// Papel e id-do-app (cuid da tabela `users`, usado como texto em campos como
// changedBy/responsibleId/createdById) vêm do `app_metadata` do usuário — que o
// Supabase inclui no JWT — sem custo de consulta ao banco por chamada.

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

export interface Session {
  user: SessionUser;
}

export async function auth(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const meta = (user.app_metadata ?? {}) as {
    user_role?: string;
    app_user_id?: string;
  };

  return {
    user: {
      id: meta.app_user_id ?? user.id,
      name: (user.user_metadata?.name as string | undefined) ?? null,
      email: user.email ?? null,
      role: meta.user_role ?? "VIEWER_RH",
    },
  };
}
