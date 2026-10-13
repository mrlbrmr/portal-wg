import { cn } from "@/lib/utils";
import { PIPELINE_GROUP_META, type PipelineGroup } from "@/lib/recruitment/candidate-presentation";

interface Props {
  summary: { total: number } & Record<PipelineGroup, number>;
  /** Candidatos com algum sinal que pede ação (teste pendente, etapa parada…). */
  attention: number;
  /** Situação filtrada pelo resumo (null = todas). */
  group: PipelineGroup | null;
  onGroupChange: (group: PipelineGroup | null) => void;
  /** O filtro "Precisa de atenção" (Filtros → Sinais) está ligado. */
  attentionActive: boolean;
  onToggleAttention: () => void;
  /** Volta a mostrar todos: limpa a situação e o filtro de atenção. */
  onShowAll: () => void;
  className?: string;
}

const ITEM =
  "inline-flex items-baseline gap-1.5 rounded-control px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60";

/**
 * Resumo do volume do processo, que também filtra: cada número é um filtro rápido (clique
 * liga, clique de novo desliga) e o total volta a mostrar todos. Combina com a busca e os
 * Filtros. O estado padrão (todos) não ganha destaque — só o filtro ligado ganha. "Fora do
 * funil" e "precisam de atenção" só aparecem quando há alguém nessa situação.
 */
export function PipelineSummary({
  summary,
  attention,
  group,
  onGroupChange,
  attentionActive,
  onToggleAttention,
  onShowAll,
  className,
}: Props) {
  const parts: Array<{ key: PipelineGroup; value: number; label: string; hint: string }> = [
    { key: "NEW", value: summary.NEW, ...PIPELINE_GROUP_META.NEW },
    { key: "IN_PROCESS", value: summary.IN_PROCESS, ...PIPELINE_GROUP_META.IN_PROCESS },
    { key: "FINALIST", value: summary.FINALIST, ...PIPELINE_GROUP_META.FINALIST },
  ];
  if (summary.CLOSED > 0 || group === "CLOSED") {
    parts.push({ key: "CLOSED", value: summary.CLOSED, ...PIPELINE_GROUP_META.CLOSED });
  }
  const showingAll = group === null && !attentionActive;

  return (
    <div
      role="group"
      aria-label="Filtrar candidatos por situação"
      className={cn("-ml-2 flex flex-wrap items-center gap-x-0.5 gap-y-1 text-meta", className)}
    >
      <button
        type="button"
        aria-pressed={showingAll}
        onClick={onShowAll}
        title={showingAll ? "Todos os candidatos da vaga" : "Mostrar todos os candidatos"}
        className={cn(ITEM, "hover:bg-wg-hover-light/70")}
      >
        <span className="font-sora text-[15px] font-semibold tabular-nums text-wg-ink">{summary.total}</span>
        <span className="text-wg-ink-muted">{summary.total === 1 ? "candidato" : "candidatos"}</span>
      </button>
      <span aria-hidden className="mx-1.5 hidden h-4 w-px self-center bg-wg-border-light sm:block" />

      {parts.map((p) => {
        const pressed = group === p.key;
        const empty = p.value === 0 && !pressed;
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={pressed}
            disabled={empty}
            onClick={() => onGroupChange(pressed ? null : p.key)}
            title={p.hint}
            className={cn(
              ITEM,
              pressed
                ? "bg-wg-sidebar shadow-[inset_0_0_0_1px_rgba(79,105,48,.3)]"
                : empty
                ? "cursor-default"
                : "hover:bg-wg-hover-light/70"
            )}
          >
            <span className={cn("font-semibold tabular-nums", empty ? "text-wg-ink-muted" : "text-wg-ink")}>{p.value}</span>
            <span className={pressed ? "text-wg-ink-secondary" : "text-wg-ink-muted"}>{p.label}</span>
          </button>
        );
      })}

      {(attention > 0 || attentionActive) && (
        <button
          type="button"
          aria-pressed={attentionActive}
          onClick={onToggleAttention}
          title="Teste não enviado ou para corrigir, ou candidato parado na etapa. Também em Filtros → Sinais."
          className={cn(
            ITEM,
            attentionActive ? "bg-warning-bg shadow-[inset_0_0_0_1px_rgba(180,121,28,.35)]" : "hover:bg-wg-hover-light/70"
          )}
        >
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 self-center rounded-full bg-warning" />
          <span className="font-semibold tabular-nums text-wg-ink">{attention}</span>
          <span className={attentionActive ? "text-warning-fg" : "text-wg-ink-muted"}>
            {attention === 1 ? "precisa de atenção" : "precisam de atenção"}
          </span>
        </button>
      )}
    </div>
  );
}
