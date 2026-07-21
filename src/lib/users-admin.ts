import { createAdminClient } from "@/lib/supabase/admin";

// Gestão de usuários RH sob o modelo dual do Supabase:
//   • tabela `public.users` — identidade de app (id cuid/uuid referenciado por
//     changedBy/responsibleId/createdById/uploadedById etc.) + papel/ativo p/ UI;
//   • `auth.users` (Supabase Auth) — credenciais + `app_metadata.{user_role,
//     app_user_id}` que entram no JWT p/ RLS. `user_metadata.name` guarda o nome.
// Toda escrita mantém os dois lados em sincronia. A ligação entre eles é o e-mail
// (único) — usuários importados têm id cuid ≠ auth uuid, então não dá p/ derivar
// um do outro.

type Admin = ReturnType<typeof createAdminClient>;

/** Encontra o usuário do Supabase Auth pelo e-mail (percorre as páginas). */
export async function getAuthUserByEmail(admin: Admin, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 200) break; // última página
  }
  return null;
}
