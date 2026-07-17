import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ElementType } from "react";
import { ListChecks, Tags } from "lucide-react";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Configurações de Admissões — RH" };

const modules: { href: string; icon: ElementType; title: string; desc: string }[] = [
  {
    href: "/admissoes/configuracoes/categorias",
    icon: Tags,
    title: "Categorias",
    desc: "Empresas, filiais, cargos, etapas do kanban, tags e tipos de documento.",
  },
  {
    href: "/admissoes/configuracoes/modelos",
    icon: ListChecks,
    title: "Modelos de Checklist",
    desc: "Templates de checklist por cargo, com grupos e itens padronizados.",
  },
];

export default async function AdmissoesConfiguracoesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/admissoes");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações de Admissões</h1>
        <p className="text-gray-500 text-sm mt-1">
          Personalize as categorias e os modelos de checklist do fluxo de admissão.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 hover:border-wg-green/50 hover:bg-wg-green/5 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-wg-green/15 text-wg-green-dark grid place-items-center mb-3">
              <m.icon className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{m.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
