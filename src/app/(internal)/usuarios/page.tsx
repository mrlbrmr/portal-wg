import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus, Pencil } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { UserToggleActions } from "@/components/internal/UserToggleActions";
import { PageHeader } from "@/components/internal/PageHeader";
import { PrimaryActionLink } from "@/components/internal/PrimaryActionLink";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Usuários — RH" };

export default async function UsuariosPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = createAdminClient();
  const { data: usersData } = await supabase
    .from("users")
    .select("id, name, email, role, active, createdAt")
    .order("createdAt", { ascending: false });
  const users = (usersData ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    createdAt: string;
  }>;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Usuários"
        subtitle="Contas de acesso ao painel interno"
        action={
          <PrimaryActionLink href="/usuarios/novo" icon={UserPlus}>
            Novo usuário
          </PrimaryActionLink>
        }
      />

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        {users.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            Nenhum usuário cadastrado.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{user.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.role === "ADMIN_RH"
                          ? "bg-wg-green/15 text-wg-green-dark"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {user.role === "ADMIN_RH" ? "Admin RH" : "Visualizador"}
                    </span>
                    {!user.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                        Inativo
                      </span>
                    )}
                    {user.id === session?.user.id && (
                      <span className="text-xs text-gray-500">(você)</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Criado em {formatDate(user.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {user.id !== session?.user.id && (
                    <UserToggleActions
                      userId={user.id}
                      currentRole={user.role}
                      isActive={user.active}
                    />
                  )}
                  <Link
                    href={user.id === session?.user.id ? "/perfil" : `/usuarios/${user.id}/editar`}
                    className="inline-flex items-center gap-1 text-xs border border-gray-300 hover:border-wg-green text-gray-600 hover:text-wg-green-dark px-2.5 py-1.5 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
