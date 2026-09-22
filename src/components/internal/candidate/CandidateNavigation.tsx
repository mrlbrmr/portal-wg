"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CandidateQueueNav {
  /** Posição 1-based na fila (null se o candidato saiu dela, ex.: reprovado). */
  index: number | null;
  total: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}

const arrow =
  "inline-flex h-8 w-8 items-center justify-center rounded-control text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50 disabled:pointer-events-none disabled:opacity-35";

/** "‹ 2 de 5 ›" — triagem sequencial sem fechar o painel. Atalhos: K (anterior) e J (próximo). */
export function CandidateNavigation({ nav, className }: { nav: CandidateQueueNav; className?: string }) {
  if (nav.total <= 1 && nav.index !== null) return null;
  return (
    <nav aria-label="Navegar entre candidatos" className={cn("flex items-center", className)}>
      <button
        type="button"
        onClick={nav.onPrev ?? undefined}
        disabled={!nav.onPrev}
        aria-label="Candidato anterior"
        title="Candidato anterior (K)"
        aria-keyshortcuts="K"
        className={arrow}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-[52px] text-center text-meta tabular-nums text-wg-ink-muted" aria-live="polite">
        {nav.index ?? "–"} de {nav.total}
      </span>
      <button
        type="button"
        onClick={nav.onNext ?? undefined}
        disabled={!nav.onNext}
        aria-label="Próximo candidato"
        title="Próximo candidato (J)"
        aria-keyshortcuts="J"
        className={arrow}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
