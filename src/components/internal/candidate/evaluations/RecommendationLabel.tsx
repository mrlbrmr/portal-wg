import { TONE_DOT, TONE_TEXT, type Tone } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { recommendationInfo } from "@/lib/recruitment/evaluations/catalog";

/**
 * Sinal discreto de recomendação/resultado: ponto colorido + texto (a cor nunca comunica
 * sozinha). Sem pílula preenchida — o parecer é o protagonista, não o selo.
 */
export function ToneLabel({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-meta font-medium", tone === "neutral" ? "text-wg-ink-muted" : TONE_TEXT[tone], className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden />
      {label}
    </span>
  );
}

export function RecommendationLabel({ code, className }: { code: string | null | undefined; className?: string }) {
  const info = recommendationInfo(code);
  return <ToneLabel tone={info.tone} label={info.label} className={className} />;
}
