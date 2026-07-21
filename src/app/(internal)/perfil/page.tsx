import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/internal/ProfileForm";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Meu Perfil — RH" };

export default async function PerfilPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, name, email, role, active, createdAt")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!user) redirect("/login");

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meu perfil</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conta criada em {formatDate(user.createdAt)} ·{" "}
          <span
            className={`font-medium ${
              user.role === "ADMIN_RH" ? "text-wg-green-dark" : "text-gray-500"
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
