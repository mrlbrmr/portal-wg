import { Info } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { MATCH_SCORE_HINT } from "@/lib/recruitment/candidate-presentation";

interface Props {
  /** 0–100, calculado pela análise de IA (lógica inalterada). */
  score: number;
  /** "card": rótulo + barra em largura total. "inline": número + barra curta (lista). */
  variant?: "card" | "inline";
  className?: string;
}

/**
 * Aderência ao perfil como indicador AUXILIAR: uma só cor (verde institucional), sem
 * vermelho/verde de "bom/ruim". O número e a barra dizem o valor; o tooltip explica.
 */
export function MatchScore({ score, variant = "card", className }: Props) {
  const hintId = useId();
  const pct = Math.max(0, Math.min(100, Math.round(score)));

  const bar = (
    <div
      role="meter"
      aria-label="Aderência ao perfil"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-describedby={hintId}
      className={cn("overflow-hidden rounded-full bg-[#EBEFE5]", variant === "card" ? "h-1 w-full" : "h-1 w-12")}
    >
      <div className="h-full rounded-full bg-wg-green-dark/60" style={{ width: `${pct}%` }} />
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2", className)} title={MATCH_SCORE_HINT}>
        <span className="w-9 text-right text-[13px] font-semibold tabular-nums text-wg-ink">{pct}%</span>
        {bar}
        <span id={hintId} className="sr-only">
          {MATCH_SCORE_HINT}
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
        <span className="inline-flex cursor-help items-center gap-1 text-wg-ink-muted" title={MATCH_SCORE_HINT}>
          Aderência ao perfil
          <Info className="h-3 w-3 opacity-60" aria-hidden />
        </span>
        <span className="font-semibold tabular-nums text-wg-ink">{pct}%</span>
      </div>
      {bar}
      <span id={hintId} className="sr-only">
        {MATCH_SCORE_HINT}
      </span>
    </div>
  );
}
