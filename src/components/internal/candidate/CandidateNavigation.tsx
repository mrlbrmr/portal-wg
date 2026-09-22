"use client";

import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CandidateQueueNav {
  /** Posição 1-based na fila (null se o candidato saiu dela, ex.: reprovado). */
  index: number | null;
  total: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  /** Vizinhos na fila — o painel adianta o carregamento deles. */
  prevId?: string | null;
  nextId?: string | null;
}

const SHORTCUT_HINT = "Use J/K para navegar entre candidatos";

const arrow =
  "inline-flex h-7 w-7 items-center justify-center rounded-control text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50 disabled:pointer-events-none disabled:opacity-35";

/**
 * "‹ 2 de 5 ›" — triagem sequencial sem fechar o painel. Os atalhos (K anterior, J
 * próximo) aparecem só no hover/foco, para não disputar atenção com o nome do candidato.
 */
export function CandidateNavigation({ nav, className }: { nav: CandidateQueueNav; className?: string }) {
  const hintId = useId();
  if (nav.total <= 1 && nav.index !== null) return null;
  return (
    <nav aria-label="Navegar entre candidatos" aria-describedby={hintId} title={SHORTCUT_HINT} className={cn("group/nav flex items-center", className)}>
      <button type="button" onClick={nav.onPrev ?? undefined} disabled={!nav.onPrev} aria-label="Candidato anterior" aria-keyshortcuts="K" className={arrow}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-[44px] text-center text-[12px] tabular-nums text-wg-ink-muted" aria-live="polite">
        {nav.index ?? "–"} de {nav.total}
      </span>
      <button type="button" onClick={nav.onNext ?? undefined} disabled={!nav.onNext} aria-label="Próximo candidato" aria-keyshortcuts="J" className={arrow}>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
      <span
        aria-hidden
        className="ml-0.5 hidden gap-0.5 text-[10.5px] font-medium text-wg-ink-muted opacity-0 transition-opacity group-hover/nav:opacity-100 group-focus-within/nav:opacity-100 lg:inline-flex"
      >
        <kbd className="rounded border border-wg-border-light bg-wg-bg px-1 font-sans leading-4">J</kbd>
        <kbd className="rounded border border-wg-border-light bg-wg-bg px-1 font-sans leading-4">K</kbd>
      </span>
      <span id={hintId} className="sr-only">
        {SHORTCUT_HINT}
      </span>
    </nav>
  );
}
