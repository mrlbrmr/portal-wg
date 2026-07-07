import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/internal/ProfileForm";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Meu Perfil — RH" };

export default async function PerfilPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Meu perfil</h1>
        <p className="text-sm text-wg-gray mt-1">
          Conta criada em {formatDate(user.createdAt)} ·{" "}
          <span
            className={`font-medium ${
              user.role === "ADMIN_RH" ? "text-wg-green" : "text-wg-gray"
            }`}
          >
            {user.role === "ADMIN_RH" ? "Admin RH" : "Visualizador"}
          </span>
        </p>
      </div>

      <ProfileForm user={{ name: user.name, email: user.email, role: user.role }} />
    </div>
  );
}
