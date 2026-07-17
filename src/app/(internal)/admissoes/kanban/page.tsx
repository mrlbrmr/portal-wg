import type { Metadata } from "next";
import { Kanban } from "lucide-react";
import { AdmissaoPlaceholder } from "@/components/internal/admissao/AdmissaoPlaceholder";

export const metadata: Metadata = { title: "Kanban de Admissões — RH" };

export default function AdmissoesKanbanPage() {
  return (
    <AdmissaoPlaceholder
      title="Kanban"
      subtitle="Acompanhe as admissões por etapa, arrastando entre as colunas."
      icon={Kanban}
      phase="Fase D2"
    />
  );
}
