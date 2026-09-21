import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  icon?: ElementType;
  title: string;
  description?: string;
  /** CTA opcional (botão/link) exibido abaixo do texto. */
  action?: ReactNode;
  /** Versão compacta para painéis e listas curtas (menos respiro vertical). */
  compact?: boolean;
  className?: string;
}

/**
 * Estado vazio reutilizável: ícone opcional em bolha, título, descrição e um
 * CTA opcional. Escreva o texto no contexto da tela ("Nenhuma vaga precisa de
 * atenção no momento."), nunca só "Nenhum resultado". Para busca/filtro sem
 * resultado, passe um action de limpar filtros.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "mb-3 flex items-center justify-center rounded-full bg-wg-sidebar text-wg-green-dark",
            compact ? "h-9 w-9" : "h-11 w-11"
          )}
        >
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
        </div>
      )}
      <p className="text-body font-medium text-wg-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-meta text-wg-ink-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
