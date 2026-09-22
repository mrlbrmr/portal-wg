import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** Ação discreta à direita do título (ex.: "Editar dados"). */
  action?: ReactNode;
  /** Complemento curto ao lado do título (ex.: contagem). */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Seção do Quick View: título + conteúdo, separada da anterior por um divisor (sem card)
 * — o painel é uma lista de seções, não uma pilha de caixas.
 */
export function Section({ title, action, meta, children, className }: Props) {
  return (
    <section className={cn("border-t border-wg-border-lighter py-4 first:border-t-0 first:pt-0", className)}>
      <div className="mb-2 flex min-h-[24px] items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-wg-ink">
          {title}
          {meta}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Linha "rótulo  valor" para dados simples (grade de 2 colunas). */
export function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] items-baseline gap-3 py-1.5 sm:grid-cols-[132px_1fr]">
      <dt className="text-meta text-wg-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-body text-wg-ink">{children}</dd>
    </div>
  );
}

/** "Não informado" discreto — dado ausente sem poluir a leitura. */
export function Missing({ children = "Não informado" }: { children?: ReactNode }) {
  return <span className="font-normal text-wg-ink-muted/80">{children}</span>;
}
