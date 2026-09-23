import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, UserPlus } from "lucide-react";
import { NewUserForm } from "@/components/internal/NewUserForm";
import { PageHeader } from "@/components/internal/PageHeader";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Novo usuário — RH" };

export default async function NovoUsuarioPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

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
        <PageHeader icon={UserPlus} title="Novo usuário" subtitle="Crie uma conta de acesso ao portal." />
        <NewUserForm />
      </div>
    </div>
  );
}
