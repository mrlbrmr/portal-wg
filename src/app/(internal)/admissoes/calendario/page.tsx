import type { Metadata } from "next";
import { Calendar } from "lucide-react";
import { AdmissaoPlaceholder } from "@/components/internal/admissao/AdmissaoPlaceholder";

export const metadata: Metadata = { title: "Calendário de Admissões — RH" };

export default function AdmissoesCalendarioPage() {
  return (
    <AdmissaoPlaceholder
      title="Calendário"
      subtitle="Datas de início, exames médicos e prazos dos checklists."
      icon={Calendar}
      phase="Fase F"
    />
  );
}
