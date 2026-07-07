import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewUserForm } from "@/components/internal/NewUserForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Novo Usuário — RH" };

export default async function NovoUsuarioPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-white mb-6">Novo Usuário</h1>
      <NewUserForm />
    </div>
  );
}
