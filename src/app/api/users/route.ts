import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { UserRole } from "@/types/domain";
import { rateLimit } from "@/lib/rate-limit";

const createUserSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  role: z.nativeEnum(UserRole).default("VIEWER_RH"),
});

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role, active, createdAt")
    .order("createdAt", { ascending: false });

  return NextResponse.json(users ?? []);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfter } = rateLimit(ip, { limit: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password, role } = parsed.data;

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });
  }

  // 1) Registro de identidade de app (id texto referenciado pelas demais tabelas;
  //    a senha real vive em auth.users, aqui fica um placeholder).
  const { data: user, error: insertError } = await supabase
    .from("users")
    .insert({ name, email, role, passwordHash: "supabase-auth" })
    .select("id, name, email, role, active, createdAt")
    .single();
  if (insertError || !user) {
    return NextResponse.json({ error: "Erro ao criar usuário." }, { status: 500 });
  }

  // 2) Usuário do Supabase Auth (credenciais + papel/id-de-app no app_metadata p/ RLS).
  const { error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { user_role: role, app_user_id: user.id },
  });
  if (authError) {
    // Desfaz o registro de app p/ não deixar usuário sem login.
    await supabase.from("users").delete().eq("id", user.id);
    return NextResponse.json({ error: "Erro ao criar credenciais de acesso." }, { status: 500 });
  }

  return NextResponse.json(user, { status: 201 });
}
