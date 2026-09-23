import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserByEmail } from "@/lib/users-admin";
import { z } from "zod";
import { UserRole } from "@/types/domain";
import { rateLimit } from "@/lib/rate-limit";
import { logActivity, diffFields } from "@/lib/activity/log";
import { accessLabel } from "@/lib/access/roles";

const updateUserSchema = z.object({
  name: z.string().min(2, "Nome obrigatório").optional(),
  email: z.string().email("E-mail inválido").optional(),
  role: z.nativeEnum(UserRole).optional(),
  active: z.boolean().optional(),
  isApprover: z.boolean().optional(),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfter } = rateLimit(ip, { limit: 20, windowMs: 60_000 });
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

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Use a página 'Meu Perfil' para editar sua própria conta." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: currentUser } = await supabase
    .from("users")
    .select("id, name, email, role, active, isApprover")
    .eq("id", id)
    .maybeSingle();
  if (!currentUser) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  // Verifica unicidade do e-mail
  if (parsed.data.email) {
    const { data: conflict } = await supabase
      .from("users")
      .select("id")
      .eq("email", parsed.data.email)
      .neq("id", id)
      .maybeSingle();
    if (conflict) {
      return NextResponse.json({ error: "E-mail já cadastrado por outro usuário." }, { status: 409 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
  // Permissão adicional "aprovar solicitações" — antes era validada mas não gravada.
  if (parsed.data.isApprover !== undefined) updateData.isApprover = parsed.data.isApprover;

  const { data: user, error: updateError } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select("id, name, email, role, active, isApprover")
    .single();
  if (updateError || !user) {
    return NextResponse.json({ error: "Erro ao atualizar usuário." }, { status: 500 });
  }

  // Espelha as mudanças no Supabase Auth (credenciais + claims do JWT).
  const authUser = await getAuthUserByEmail(supabase, currentUser.email);
  if (authUser) {
    const attrs: Record<string, unknown> = {};
    if (parsed.data.email !== undefined) attrs.email = parsed.data.email;
    if (parsed.data.password) attrs.password = parsed.data.password;
    if (parsed.data.name !== undefined) {
      attrs.user_metadata = { ...authUser.user_metadata, name: parsed.data.name };
    }
    if (parsed.data.role !== undefined) {
      attrs.app_metadata = { ...authUser.app_metadata, user_role: parsed.data.role };
    }
    // Desativar = bloquear no Supabase Auth (login e renovação de sessão). Sem isso o
    // `users.active` era só visual: nada no login nem nas policies o consultava.
    if (parsed.data.active !== undefined && parsed.data.active !== currentUser.active) {
      attrs.ban_duration = parsed.data.active ? "none" : "876000h";
    }
    if (Object.keys(attrs).length > 0) {
      const { error: authError } = await supabase.auth.admin.updateUserById(authUser.id, attrs);
      if (authError) {
        console.error("[users] updateUserById", authError.message);
        await logUserChanges(supabase, session.user.id, currentUser, user, false);
        return NextResponse.json(
          { error: "Os dados foram salvos, mas o acesso de login não foi atualizado. Tente novamente." },
          { status: 502 }
        );
      }
    }
  }

  await logUserChanges(supabase, session.user.id, currentUser, user, Boolean(parsed.data.password));

  return NextResponse.json(user);
}

type UserRow = { id: string; name: string; email: string; role: string; active: boolean; isApprover: boolean | null };

/** Registra em Atividades o que mudou: perfil/permissões, ativação e dados cadastrais. */
async function logUserChanges(
  supabase: ReturnType<typeof createAdminClient>,
  actorId: string,
  before: UserRow,
  after: UserRow,
  passwordReset: boolean
) {
  const base = { entity: "USER" as const, entityId: after.id, userId: actorId };
  const accessFrom = accessLabel({ role: before.role, isApprover: before.isApprover });
  const accessTo = accessLabel({ role: after.role, isApprover: after.isApprover });
  if (accessFrom !== accessTo) {
    await logActivity(supabase, {
      ...base,
      action: "USER_ROLE_CHANGED",
      description: `${accessFrom} → ${accessTo}`,
      metadata: { from: accessFrom, to: accessTo, subjectName: after.name },
    });
  }
  if (before.active !== after.active) {
    await logActivity(supabase, {
      ...base,
      action: after.active ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      description: after.active ? "Acesso ao painel reativado" : "Acesso ao painel desativado",
      metadata: { from: before.active ? "Ativo" : "Desativado", to: after.active ? "Ativo" : "Desativado", subjectName: after.name },
    });
  }
  const changes = diffFields(
    { name: before.name, email: before.email },
    { name: after.name, email: after.email },
    { name: "Nome", email: "E-mail" }
  );
  if (passwordReset) changes.push({ label: "Senha", from: null, to: "Redefinida" });
  if (changes.length > 0) {
    await logActivity(supabase, {
      ...base,
      action: "USER_UPDATED",
      description: `Dados atualizados: ${changes.map((c) => c.label).join(", ")}`,
      metadata: { changes, subjectName: after.name },
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Você não pode excluir sua própria conta." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("id", id)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  // Remove das credenciais (auth.users) e da identidade de app (users).
  const authUser = await getAuthUserByEmail(supabase, target.email);
  if (authUser) {
    await supabase.auth.admin.deleteUser(authUser.id);
  }
  await supabase.from("users").delete().eq("id", id);
  await logActivity(supabase, {
    action: "USER_DELETED",
    entity: "USER",
    entityId: id,
    userId: session.user.id,
    description: "Conta excluída permanentemente",
    metadata: { subjectName: target.name as string, email: target.email as string },
  });

  return NextResponse.json({ success: true });
}
