import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_SOFT, TONE_TEXT, type Tone } from "@/components/ui/StatusBadge";

export interface MetricComparison {
  /** Variação percentual já calculada (ex.: 16.7). Só informe quando a base for válida. */
  deltaPct: number;
  /** Texto do período de comparação (ex.: "vs. 30 dias anteriores"). */
  label: string;
  /** Subir é bom? Define a cor (ex.: novas admissões = neutro; atrasos = ruim). */
  goodWhenUp?: boolean | null;
}

interface Props {
  label: string;
  value: ReactNode;
  icon?: ElementType;
  /** Tom do ícone — reforça o significado (warning para pendências etc.). */
  tone?: Tone;
  /** Linha de contexto abaixo do número ("2 aguardando ação do RH"). */
  context?: ReactNode;
  comparison?: MetricComparison | null;
  /** Explicação de como o número é calculado (tooltip nativo + leitor de tela). */
  hint?: string;
  href?: string;
  className?: string;
}

function fmtPct(n: number) {
  const abs = Math.abs(n);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${abs.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/**
 * Card de indicador dos Relatórios: rótulo + ícone no topo, número em destaque e uma
 * linha de contexto real (pendências, comparação com o período anterior). Nunca passe
 * comparação sem base suficiente — o componente não inventa variação.
 */
export function MetricCard({ label, value, icon: Icon, tone = "neutral", context, comparison, hint, href, className }: Props) {
  const trendTone: Tone =
    !comparison || comparison.deltaPct === 0 || comparison.goodWhenUp == null
      ? "neutral"
      : (comparison.deltaPct > 0) === comparison.goodWhenUp
        ? "success"
        : "danger";
  const TrendIcon = !comparison || comparison.deltaPct === 0 ? Minus : comparison.deltaPct > 0 ? ArrowUpRight : ArrowDownRight;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-meta font-medium text-wg-ink-muted" title={hint}>
          {label}
          {hint && <span className="sr-only">. {hint}</span>}
        </p>
        {Icon && (
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-control", TONE_SOFT[tone])}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-1 font-sora text-[28px] font-semibold leading-none tabular-nums text-wg-ink">{value}</p>
      {(context || comparison) && (
        <div className="mt-2.5 space-y-0.5 text-[12.5px] leading-snug">
          {comparison && (
            <p className={cn("inline-flex items-center gap-1 font-medium", TONE_TEXT[trendTone])}>
              <TrendIcon className="h-3.5 w-3.5" aria-hidden />
              {fmtPct(comparison.deltaPct)}
              <span className="font-normal text-wg-ink-muted">{comparison.label}</span>
            </p>
          )}
          {context && <div className="text-wg-ink-muted">{context}</div>}
        </div>
      )}
    </>
  );

  const base = cn("flex flex-col rounded-card border border-wg-border-lighter bg-white px-4 py-3.5", className);
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          "transition-colors hover:border-wg-green/60 hover:bg-[#FBFCF9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
        )}
      >
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}
