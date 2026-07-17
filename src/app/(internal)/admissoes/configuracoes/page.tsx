import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { auth } from "@/lib/auth";
import { AdmissaoPlaceholder } from "@/components/internal/admissao/AdmissaoPlaceholder";

export const metadata: Metadata = { title: "Configurações de Admissões — RH" };

export default async function AdmissoesConfiguracoesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/admissoes");

  return (
    <AdmissaoPlaceholder
      title="Configurações de Admissões"
      subtitle="Categorias (empresas, filiais, cargos, etapas, tags, tipos de documento) e modelos de checklist."
      icon={Settings}
      phase="Fase E"
    />
  );
}
