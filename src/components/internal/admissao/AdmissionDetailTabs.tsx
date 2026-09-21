"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DetailTab {
  key: string;
  label: string;
  /** Contador/alerta ao lado do rótulo (ex.: "3 pendentes"). */
  badge?: { text: string; tone: "warning" | "neutral" };
  content: ReactNode;
}

interface Props {
  tabs: DetailTab[];
  /** Aba inicial (vinda de ?aba= na URL). */
  initialTab?: string;
}

/**
 * Abas da ficha da admissão (padrão WAI-ARIA: setas ←/→, Home/End). A aba ativa fica na
 * URL (?aba=documentos) — dá para linkar direto para "Documentos" a partir de pendências.
 */
export function AdmissionDetailTabs({ tabs, initialTab }: Props) {
  const [active, setActive] = useState(tabs.some((t) => t.key === initialTab) ? initialTab! : tabs[0]?.key);
  const baseId = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(key: string, focus = false) {
    setActive(key);
    if (focus) refs.current[key]?.focus();
    const url = new URL(window.location.href);
    if (key === tabs[0]?.key) url.searchParams.delete("aba");
    else url.searchParams.set("aba", key);
    window.history.replaceState(window.history.state, "", url);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = tabs.findIndex((t) => t.key === active);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      select(tabs[next].key, true);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div
        role="tablist"
        aria-label="Seções da admissão"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-wg-border-lighter"
      >
        {tabs.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[t.key] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.key)}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
                selected
                  ? "border-wg-green-dark font-semibold text-wg-ink"
                  : "border-transparent font-medium text-wg-ink-muted hover:text-wg-ink"
              )}
            >
              {t.label}
              {t.badge && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                    t.badge.tone === "warning" ? "bg-warning-bg text-warning-fg" : "bg-neutral-bg text-neutral-fg"
                  )}
                >
                  {t.badge.text}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`${baseId}-panel-${t.key}`}
          aria-labelledby={`${baseId}-tab-${t.key}`}
          hidden={t.key !== active}
          tabIndex={0}
          className="tab-content min-w-0 focus-visible:outline-offset-4"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
