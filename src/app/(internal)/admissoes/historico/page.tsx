import type { Metadata } from "next";
import { History } from "lucide-react";
import { AdmissaoPlaceholder } from "@/components/internal/admissao/AdmissaoPlaceholder";

export const metadata: Metadata = { title: "Histórico de Admissões — RH" };

export default function AdmissoesHistoricoPage() {
  return (
    <AdmissaoPlaceholder
      title="Histórico"
      subtitle="Log de atividades das admissões — quem fez o quê e quando."
      icon={History}
      phase="Fase F"
    />
  );
}
