import { JOB_PRIORITY_BADGE, JOB_PRIORITY_LABELS } from "@/lib/utils";

interface Props {
  priority: string;
  /** Exibe também a prioridade MEDIUM (por padrão oculta para reduzir ruído). */
  showMedium?: boolean;
  className?: string;
}

/**
 * Pílula colorida de prioridade da vaga. Por padrão não renderiza a
 * prioridade MEDIUM (default da maioria das vagas) para deixar os cards
 * limpos — só destaca o que precisa de atenção (Alta/Urgente) e Baixa.
 */
export function PriorityBadge({ priority, showMedium = false, className = "" }: Props) {
  if (priority === "MEDIUM" && !showMedium) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        JOB_PRIORITY_BADGE[priority] ?? "bg-gray-100 text-gray-600"
      } ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {JOB_PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}
