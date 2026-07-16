import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CONFIG } from "@/lib/homepage-config";
import HomepageConfigForm from "@/components/internal/HomepageConfigForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Configurações — RH" };

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  const config = await prisma.homepageConfig.findUnique({
    where: { id: "singleton" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Configurações da Homepage
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Controle o que aparece nos cards de vagas do portal público.
        </p>
      </div>
      <HomepageConfigForm initialConfig={config ?? DEFAULT_CONFIG} />
    </div>
  );
}
