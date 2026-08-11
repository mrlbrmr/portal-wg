import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadFormConfig } from "@/lib/admissao/form-config-loader";
import { FormConfigEditor } from "@/components/internal/admissao/FormConfigEditor";

export const metadata: Metadata = { title: "Formulário de Admissão Digital — Configurações — RH" };

export default async function FormularioAdmissaoConfigPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const config = await loadFormConfig();

  return (
    <div>
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Configurações
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Formulário de Admissão Digital</h1>
        <p className="text-gray-500 text-sm mt-1">
          Edite todo o formulário que os candidatos aprovados preenchem: textos, opções,
          perguntas, documentos e suas condições de exibição. As alterações valem para os
          próximos links gerados e para links ainda não preenchidos.
        </p>
      </div>

      <FormConfigEditor initial={config} />
    </div>
  );
}
