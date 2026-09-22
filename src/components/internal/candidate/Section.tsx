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
 * Seção do Quick View: título + conteúdo. A separação vem do espaçamento e do título —
 * sem linha entre seções (divisores só onde agrupam blocos grandes, no nível da aba).
 */
export function Section({ title, action, meta, children, className }: Props) {
  return (
    <section className={cn("pt-5 first:pt-0", className)}>
      <div className="mb-1.5 flex min-h-[28px] items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-wg-ink">
          {title}
          {meta}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Linha "rótulo  valor" para dados simples (grade de 2 colunas, sem linhas de tabela). */
export function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] items-baseline gap-3 py-1 sm:grid-cols-[124px_1fr]">
      <dt className="text-meta text-wg-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-body text-wg-ink">{children}</dd>
    </div>
  );
}

/** Dado ausente: discreto, menor e neutro — nunca com o peso de um dado preenchido. */
export function Missing({ children = "Não informado." }: { children?: ReactNode }) {
  return <span className="text-meta font-normal text-wg-ink-muted/80">{children}</span>;
}
