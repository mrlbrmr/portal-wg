import { cn } from "@/lib/utils";
import { PIPELINE_GROUP_META, type PipelineGroup } from "@/lib/recruitment/candidate-presentation";

interface Props {
  summary: { total: number } & Record<PipelineGroup, number>;
  /** Candidatos com algum sinal que pede ação (teste pendente, etapa parada…). */
  attention: number;
  className?: string;
}

/**
 * Resumo do volume do processo, integrado ao cabeçalho: texto, não botões. Cada número
 * explica no tooltip como é contado. "Fora do funil" e "precisam de atenção" só aparecem
 * quando há alguém nessa situação.
 */
export function PipelineSummary({ summary, attention, className }: Props) {
  const parts: Array<{ key: string; value: number; label: string; hint: string; dot?: string }> = [
    { key: "NEW", value: summary.NEW, ...PIPELINE_GROUP_META.NEW },
    { key: "IN_PROCESS", value: summary.IN_PROCESS, ...PIPELINE_GROUP_META.IN_PROCESS },
    { key: "FINALIST", value: summary.FINALIST, ...PIPELINE_GROUP_META.FINALIST },
  ];
  if (summary.CLOSED > 0) parts.push({ key: "CLOSED", value: summary.CLOSED, ...PIPELINE_GROUP_META.CLOSED });
  if (attention > 0) {
    parts.push({
      key: "attention",
      value: attention,
      label: attention === 1 ? "precisa de atenção" : "precisam de atenção",
      hint: "Teste não enviado ou para corrigir, ou candidato parado na etapa. Filtre em Filtros → Sinais.",
      dot: "bg-warning",
    });
  }

  return (
    <ul className={cn("flex flex-wrap items-baseline gap-x-4 gap-y-1 text-meta", className)} aria-label="Resumo do pipeline">
      <li className="flex items-baseline gap-1.5 pr-4 sm:border-r sm:border-wg-border-light">
        <span className="font-sora text-[15px] font-semibold tabular-nums text-wg-ink">{summary.total}</span>
        <span className="text-wg-ink-muted">{summary.total === 1 ? "candidato" : "candidatos"}</span>
      </li>
      {parts.map((p) => (
        <li key={p.key} className="flex items-baseline gap-1.5" title={p.hint}>
          {p.dot && <span aria-hidden className={cn("h-1.5 w-1.5 self-center rounded-full", p.dot)} />}
          <span className="font-semibold tabular-nums text-wg-ink">{p.value}</span>
          <span className="text-wg-ink-muted">{p.label}</span>
        </li>
      ))}
    </ul>
  );
}
