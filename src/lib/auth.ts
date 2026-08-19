import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

export interface Session {
  user: SessionUser;
}

// cache() deduplica chamadas dentro do mesmo ciclo de render do React —
// layout + página + server actions compartilham um único getUser() por request.
export const auth = cache(async function auth(): Promise<Session | null> {
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
});
