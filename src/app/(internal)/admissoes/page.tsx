import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Admissões — RH" };

// Landing do módulo de Admissões (onboarding).
//
// Fase C (shell/navegação): placeholder estático — ainda NÃO consulta o banco,
// pois as tabelas `admission_*` só são criadas no próximo deploy (o build roda
// `prisma db push`). O conteúdo real (lista, kanban, ficha) chega na Fase D.
export default function AdmissoesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admissões</h1>
        <p className="text-gray-500 text-sm mt-1">
          Controle de admissões ativas — onboarding, checklists e documentação dos novos
          colaboradores do Grupo WG.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <EmptyState
          icon={ClipboardCheck}
          title="Módulo em construção"
          description="Em breve você acompanhará aqui as admissões em andamento, com kanban de etapas, checklists por cargo e anexos. Esta é a estrutura inicial do módulo."
        />
      </div>
    </div>
  );
}
