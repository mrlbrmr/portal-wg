import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** Contexto curto ao lado do título (ex.: "12 no total"). */
  meta?: ReactNode;
  description?: ReactNode;
  /** Link/ação no canto direito do cabeçalho (ex.: "Ver todas"). */
  action?: ReactNode;
  children: ReactNode;
  /** Remove o padding do corpo (listas que vão até a borda). */
  flush?: boolean;
  className?: string;
  id?: string;
}

/**
 * Painel de seção: card branco (radius de card) com cabeçalho padronizado.
 * Use para blocos de trabalho — não para embrulhar cada informação solta.
 */
export function Panel({ title, meta, description, action, children, flush = false, className, id }: Props) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("flex flex-col rounded-card border border-wg-border-lighter bg-white", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 px-5 pb-2 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 id={headingId} className="font-sora text-section-title text-wg-ink">
              {title}
            </h2>
            {meta && <span className="text-meta text-wg-ink-muted">{meta}</span>}
          </div>
          {description && <p className="mt-0.5 text-meta text-wg-ink-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={flush ? "pb-2" : "px-5 pb-5"}>{children}</div>
    </section>
  );
}

/** Link textual padrão de cabeçalho de painel ("Ver todas →"). */
export const panelLinkClass =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-meta font-semibold text-wg-green-dark hover:bg-wg-hover-light";
