import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { EditUserForm } from "@/components/internal/EditUserForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Editar Usuário — RH" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarUsuarioPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  // Admin editando a própria conta → redireciona para /perfil
  if (id === session.user.id) redirect("/perfil");

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user) notFound();

  return (
    <div className="max-w-lg">
      <Link
        href="/usuarios"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-wg-green-dark transition-colors mb-5"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar aos usuários
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Editar usuário</h1>
      <p className="text-sm text-gray-500 mb-6">{user.email}</p>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
        <EditUserForm user={user} />
      </div>
    </div>
  );
}
