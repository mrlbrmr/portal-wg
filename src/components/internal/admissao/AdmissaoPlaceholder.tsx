import type { ElementType } from "react";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props {
  title: string;
  subtitle: string;
  icon: ElementType;
  phase: string;
}

/**
 * Placeholder padrão das sub-seções de Admissões ainda não implementadas.
 * Mantém a navegação sem 404 enquanto as fases seguintes não chegam.
 */
export function AdmissaoPlaceholder({ title, subtitle, icon, phase }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <EmptyState
          icon={icon}
          title="Em construção"
          description={`Esta seção será entregue na ${phase} do módulo de Admissões.`}
        />
      </div>
    </div>
  );
}
