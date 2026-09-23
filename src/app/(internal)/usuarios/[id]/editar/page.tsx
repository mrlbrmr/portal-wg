import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { EditUserForm } from "@/components/internal/EditUserForm";
import Link from "next/link";
import { ChevronLeft, UserCog } from "lucide-react";
import { PageHeader } from "@/components/internal/PageHeader";
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

  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, name, email, role, isApprover, active")
    .eq("id", id)
    .maybeSingle();
  if (!user) notFound();

  return (
    <div className="mx-auto w-full max-w-[1480px]">
      <div className="max-w-xl">
        <Link
          href="/usuarios"
          className="mb-4 inline-flex items-center gap-1 rounded-sm text-meta text-wg-ink-muted transition-colors hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Usuários
        </Link>
        <PageHeader icon={UserCog} title="Editar usuário" subtitle={user.email} />
        <div className="rounded-card border border-wg-border-lighter bg-white p-6">
          <EditUserForm user={user} />
        </div>
      </div>
    </div>
  );
}
