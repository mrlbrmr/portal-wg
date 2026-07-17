import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { AdmissaoPlaceholder } from "@/components/internal/admissao/AdmissaoPlaceholder";

export const metadata: Metadata = { title: "Relatórios de Admissões — RH" };

export default function AdmissoesRelatoriosPage() {
  return (
    <AdmissaoPlaceholder
      title="Relatórios"
      subtitle="Indicadores de admissões por período, cargo, empresa e etapa."
      icon={BarChart3}
      phase="Fase F"
    />
  );
}
