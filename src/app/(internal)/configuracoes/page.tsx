import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Megaphone, ChevronRight } from "lucide-react";
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

      <div className="mt-6">
        <Link
          href="/configuracoes/divulgacao"
          className="flex items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-xl px-5 py-4 hover:border-wg-green/40 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-wg-green/15 text-wg-green-dark flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Divulgação de vagas</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Conexões com canais externos (LinkedIn) para divulgar as vagas.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-wg-green transition-colors shrink-0" />
        </Link>
      </div>
    </div>
  );
}
