import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserByEmail } from "@/lib/users-admin";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

const updateMeSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "Nova senha deve ter pelo menos 8 caracteres").optional(),
  })
  .refine((d) => !(d.newPassword && !d.currentPassword), {
    message: "Informe a senha atual para trocar a senha.",
    path: ["currentPassword"],
  });

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, name, email, role, active, createdAt")
    .eq("id", session.user.id)
    .maybeSingle();

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfter } = rateLimit(ip, { limit: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = updateMeSchema.safeParse(body);
  if (!parsed.success) {
    const msgs = parsed.error.flatten();
    const first =
      Object.values(msgs.fieldErrors).flat()[0] ?? msgs.formErrors[0] ?? "Dados inválidos.";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { name, currentPassword, newPassword } = parsed.data;

  const supabase = createAdminClient();
  const { data: me } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  if (newPassword && currentPassword) {
    // Valida a senha atual tentando autenticar num cliente isolado (sem persistir
    // sessão p/ não afetar os cookies do usuário logado).
    const verifier = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error: signInError } = await verifier.auth.signInWithPassword({
      email: me.email,
      password: currentPassword,
    });
    if (signInError) {
      return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
    }
  }

  if (!name && !newPassword) {
    return NextResponse.json({ error: "Nenhum dado para atualizar." }, { status: 400 });
  }

  // Nome → tabela de app; nome/senha → Supabase Auth.
  if (name) {
    await supabase.from("users").update({ name }).eq("id", me.id);
  }

  const authUser = await getAuthUserByEmail(supabase, me.email);
  if (authUser) {
    const attrs: Record<string, unknown> = {};
    if (name) attrs.user_metadata = { ...authUser.user_metadata, name };
    if (newPassword) attrs.password = newPassword;
    if (Object.keys(attrs).length > 0) {
      await supabase.auth.admin.updateUserById(authUser.id, attrs);
    }
  }

  const { data: updated } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("id", me.id)
    .maybeSingle();

  return NextResponse.json(updated);
}
