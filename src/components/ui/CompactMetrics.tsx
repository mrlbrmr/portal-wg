import Link from "next/link";
import { cn } from "@/lib/utils";
import { TONE_DOT, type Tone } from "@/components/ui/StatusBadge";

export interface CompactMetric {
  label: string;
  value: number | string;
  href?: string;
  /** Ponto colorido antes do rótulo — só quando o número tem conotação de estado. */
  tone?: Tone;
  /** Tooltip explicando como o número é calculado. */
  hint?: string;
}

interface Props {
  /** Total em destaque à esquerda (ex.: "26 vagas"). */
  total: { value: number | string; label: string };
  items: CompactMetric[];
  className?: string;
}

/**
 * Faixa de métricas compacta para páginas operacionais (Vagas, Admissões): ocupa uma
 * linha em vez de uma grade de cards. Ex.: 26 vagas | 7 abertas · 1 rascunho · 4 canceladas.
 */
export function CompactMetrics({ total, items, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-wg-border-lighter bg-white px-4 py-2.5",
        className
      )}
    >
      <p className="flex items-baseline gap-1.5 pr-5 sm:border-r sm:border-wg-border-lighter">
        <span className="font-sora text-lg font-semibold tabular-nums text-wg-ink">{total.value}</span>
        <span className="text-meta text-wg-ink-muted">{total.label}</span>
      </p>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {items.map((m) => {
          const inner = (
            <>
              {m.tone && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[m.tone])} />}
              <span className="font-semibold tabular-nums text-wg-ink">{m.value}</span>
              <span className="text-wg-ink-muted">{m.label}</span>
            </>
          );
          return (
            <li key={m.label} className="text-meta">
              {m.href ? (
                <Link
                  href={m.href}
                  title={m.hint}
                  className="inline-flex items-center gap-1.5 rounded-md px-1 -mx-1 hover:bg-wg-hover-light"
                >
                  {inner}
                </Link>
              ) : (
                <span title={m.hint} className="inline-flex items-center gap-1.5">
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
