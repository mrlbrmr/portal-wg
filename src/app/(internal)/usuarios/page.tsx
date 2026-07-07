import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { UserToggleActions } from "@/components/internal/UserToggleActions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Usuários — RH" };

export default async function UsuariosPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuários</h1>
          <p className="text-wg-gray text-sm mt-1">Contas de acesso ao painel interno</p>
        </div>
        <Link
          href="/usuarios/novo"
          className="flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Novo usuário
        </Link>
      </div>

      <div className="bg-wg-card border border-wg-border rounded-xl overflow-hidden">
        {users.length === 0 ? (
          <div className="py-12 text-center text-wg-gray text-sm">
            Nenhum usuário cadastrado.
          </div>
        ) : (
          <div className="divide-y divide-wg-border">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{user.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.role === "ADMIN_RH"
                          ? "bg-wg-green/10 text-wg-green"
                          : "bg-wg-border text-wg-gray"
                      }`}
                    >
                      {user.role === "ADMIN_RH" ? "Admin RH" : "Visualizador"}
                    </span>
                    {!user.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
                        Inativo
                      </span>
                    )}
                    {user.id === session?.user.id && (
                      <span className="text-xs text-wg-gray">(você)</span>
                    )}
                  </div>
                  <p className="text-xs text-wg-gray mt-0.5">{user.email}</p>
                  <p className="text-xs text-wg-gray/60 mt-0.5">
                    Criado em {formatDate(user.createdAt)}
                  </p>
                </div>

                {user.id !== session?.user.id && (
                  <UserToggleActions
                    userId={user.id}
                    currentRole={user.role}
                    isActive={user.active}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
