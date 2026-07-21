import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/internal/admissao/CategoryManager";

export const metadata: Metadata = { title: "Categorias de Admissões — RH" };

export default async function CategoriasPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/admissoes");

  const supabase = await createClient();
  const [companiesRes, branchesRes, positionsRes, documentTypesRes, tagsRes, stagesRes] =
    await Promise.all([
      supabase.from("admission_companies").select("id, name").order("sortOrder", { ascending: true }),
      supabase.from("admission_branches").select("id, name").order("sortOrder", { ascending: true }),
      supabase.from("admission_positions").select("id, name").order("sortOrder", { ascending: true }),
      supabase
        .from("admission_document_types")
        .select("id, name, required")
        .order("sortOrder", { ascending: true }),
      supabase.from("admission_tags").select("id, name, color").order("name", { ascending: true }),
      supabase.from("admission_stages").select("id, name, color, isFinal").order("sortOrder", { ascending: true }),
    ]);

  const companies = (companiesRes.data ?? []) as Array<{ id: string; name: string }>;
  const branches = (branchesRes.data ?? []) as Array<{ id: string; name: string }>;
  const positions = (positionsRes.data ?? []) as Array<{ id: string; name: string }>;
  const documentTypes = (documentTypesRes.data ?? []) as Array<{
    id: string;
    name: string;
    required: boolean;
  }>;
  const tags = (tagsRes.data ?? []) as Array<{ id: string; name: string; color: string }>;
  const stages = (stagesRes.data ?? []) as Array<{ id: string; name: string; color: string; isFinal: boolean }>;

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
          description="Colunas do quadro de admissões, com cor. Marque a etapa final para calcular admissões concluídas."
          items={stages}
          hasColor
          hasIsFinal
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
          description="Categorias dos anexos. Marque como obrigatório para entrar no % de documentos da ficha."
          items={documentTypes}
          hasRequired
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
