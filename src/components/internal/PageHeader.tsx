import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: ReactNode;
  /** Ícone lucide opcional à esquerda do título (páginas de módulo: Calendário, Relatórios…). */
  icon?: ElementType;
  /** Slot de ação(ões) no canto superior direito (botões de criar/exportar). */
  action?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão das páginas internas: título (text-page-title) + subtítulo opcional
 * à esquerda e um slot de ação à direita. Ordem das ações: secundárias primeiro, a
 * primária (verde) por último, sempre no canto superior direito.
 */
export function PageHeader({ title, subtitle, icon: Icon, action, className }: Props) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            aria-hidden
            className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-control border border-wg-border-lighter bg-white text-wg-green-dark sm:flex md:mt-1"
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-sora text-2xl font-semibold tracking-tight text-wg-ink md:text-page-title">{title}</h1>
          {subtitle && <p className="mt-1 text-body text-wg-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
