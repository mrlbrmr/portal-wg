import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/internal/admissao/CategoryManager";

export const metadata: Metadata = { title: "Categorias de Admissões — RH" };

export default async function CategoriasPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/admissoes");

  const [companies, branches, positions, documentTypes, tags, stages] = await Promise.all([
    prisma.company.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.branch.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.position.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.documentType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.admissionTag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    prisma.admissionStage.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, color: true } }),
  ]);

  return (
    <div className="max-w-5xl">
      <Link
        href="/admissoes/configuracoes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Configurações
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
        <p className="text-gray-500 text-sm mt-1">
          Listas usadas nos formulários de admissão. Remover um item apenas o desvincula das
          admissões existentes (não as apaga).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryManager
          entity="stage"
          title="Etapas do Kanban"
          description="Colunas do quadro de admissões, com cor."
          items={stages}
          hasColor
          addPlaceholder="Ex.: Documentação"
        />
        <CategoryManager
          entity="position"
          title="Cargos"
          description="Usados nas admissões e nos modelos de checklist."
          items={positions}
          addPlaceholder="Ex.: Motorista de Caminhão"
        />
        <CategoryManager
          entity="company"
          title="Empresas"
          items={companies}
          addPlaceholder="Ex.: WG Baterias"
        />
        <CategoryManager
          entity="branch"
          title="Filiais"
          items={branches}
          addPlaceholder="Ex.: Matriz"
        />
        <CategoryManager
          entity="documentType"
          title="Tipos de documento"
          description="Categorias dos anexos das admissões."
          items={documentTypes}
          addPlaceholder="Ex.: Comprovante de Residência"
        />
        <CategoryManager
          entity="tag"
          title="Tags"
          description="Etiquetas coloridas para marcar admissões."
          items={tags}
          hasColor
          addPlaceholder="Ex.: Prioritária"
        />
      </div>
    </div>
  );
}
