import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPlus, UsersRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/internal/PageHeader";
import { PrimaryActionLink } from "@/components/internal/PrimaryActionLink";
import { PageContainer } from "@/components/ui/PageContainer";
import { CompactMetrics } from "@/components/ui/CompactMetrics";
import { UsersTable, type UserRow } from "@/components/internal/users/UsersTable";

export const metadata: Metadata = { title: "Usuários — RH" };

/** Último login por e-mail, lido do Supabase Auth (onde vivem as credenciais). */
async function lastSignIns(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, string | null> | null> {
  const map = new Map<string, string | null>();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    for (const u of data.users) if (u.email) map.set(u.email.toLowerCase(), u.last_sign_in_at ?? null);
    if (data.users.length < 200) break;
  }
  return map;
}

export default async function UsuariosPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = createAdminClient();
  const [{ data: usersData, error }, signIns] = await Promise.all([
    supabase.from("users").select("id, name, email, role, isApprover, active, createdAt").order("name", { ascending: true }),
    lastSignIns(supabase),
  ]);
  const base = (usersData ?? []) as Array<Omit<UserRow, "lastSignInAt">>;
  const users: UserRow[] = base.map((u) => ({
    ...u,
    isApprover: !!u.isApprover,
    // Sem leitura do Auth → desconhecido ("Nunca acessou" seria afirmar demais).
    lastSignInAt: signIns?.has(u.email.toLowerCase()) ? signIns.get(u.email.toLowerCase()) : undefined,
  }));

  const active = users.filter((u) => u.active);
  const neverSigned = signIns ? active.filter((u) => u.lastSignInAt === null).length : 0;

  return (
    <PageContainer>
      <PageHeader
        className="mb-0"
        icon={UsersRound}
        title="Usuários"
        subtitle="Gerencie contas, perfis e permissões de acesso ao portal."
        action={
          <PrimaryActionLink href="/usuarios/novo" icon={UserPlus}>
            Novo usuário
          </PrimaryActionLink>
        }
      />

      {error ? (
        <div role="alert" className="rounded-card border border-danger-border bg-danger-bg px-4 py-3 text-body text-danger-fg">
          Não foi possível carregar os usuários agora. Atualize a página em instantes.
        </div>
      ) : (
        <>
          <CompactMetrics
            total={{ value: active.length, label: active.length === 1 ? "usuário ativo" : "usuários ativos" }}
            items={[
              { label: "administradores", value: active.filter((u) => u.role === "ADMIN_RH").length },
              { label: "visualizadores", value: active.filter((u) => u.role === "VIEWER_RH").length },
              {
                label: "aprovam solicitações",
                value: active.filter((u) => u.isApprover).length,
                hint: "Usuários com a permissão adicional de aprovar solicitações de vaga",
              },
              ...(neverSigned > 0 ? [{ label: "nunca acessaram", value: neverSigned, tone: "warning" as const }] : []),
              { label: "desativados", value: users.length - active.length, tone: "neutral" as const },
            ]}
          />
          <UsersTable users={users} currentUserId={session.user.id} signInsAvailable={!!signIns} />
          {!signIns && (
            <p className="text-[12px] text-wg-ink-muted">O último acesso não pôde ser consultado agora.</p>
          )}
        </>
      )}
    </PageContainer>
  );
}
