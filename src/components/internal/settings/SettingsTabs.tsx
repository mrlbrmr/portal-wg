"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, type ElementType, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const tabBase =
  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control px-3 text-[13px] font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50";
const tabIdle = "text-wg-ink-muted hover:bg-wg-hover-light hover:text-wg-ink";
const tabActive = "bg-white text-wg-ink shadow-[0_1px_2px_rgba(26,34,19,.08)] ring-1 ring-wg-border-light";

const railClass =
  "flex gap-1 overflow-x-auto rounded-card border border-wg-border-lighter bg-wg-bg p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Navegação interna por ROTAS (ex.: Cadastros › Cargos | Empresas | …).
 * Cada aba é um link com URL própria — deep linking e botão voltar funcionam.
 */
export function SettingsSubnav({
  items,
  label,
}: {
  items: Array<{ href: string; label: string; icon?: ElementType }>;
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="sticky top-11 z-10 -mx-1 mb-5 bg-slate-50/90 px-1 py-1 backdrop-blur md:top-0">
      <div className={railClass}>
        {items.map(({ href, label: text, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(tabBase, active ? tabActive : tabIdle)}
            >
              {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
              {text}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Abas NA MESMA PÁGINA (ex.: Conteúdo | Perguntas | Documentos…), com o padrão
 * WAI-ARIA de tablist: ← → navegam, Home/End vão às pontas.
 * Os painéis devem usar `id={tabPanelId(baseId, key)}` e `aria-labelledby={tabId(baseId, key)}`.
 */
export function SettingsTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  baseId,
}: {
  tabs: Array<{ key: K; label: string; icon?: ElementType; badge?: string | number }>;
  value: K;
  onChange: (key: K) => void;
  label: string;
  baseId: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].key);
    refs.current[next]?.focus();
  }

  return (
    <div className="sticky top-11 z-10 -mx-1 mb-5 bg-slate-50/90 px-1 py-1 backdrop-blur md:top-0">
      <div role="tablist" aria-label={label} className={railClass}>
        {tabs.map(({ key, label: text, icon: Icon, badge }, i) => {
          const active = key === value;
          return (
            <button
              key={key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(baseId, key)}
              aria-selected={active}
              aria-controls={tabPanelId(baseId, key)}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(tabBase, active ? tabActive : tabIdle)}
            >
              {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
              {text}
              {badge !== undefined && (
                <span className="rounded-full bg-neutral-bg px-1.5 text-[11px] font-semibold text-neutral-fg">{badge}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const tabId = (base: string, key: string) => `${base}-tab-${key}`;
export const tabPanelId = (base: string, key: string) => `${base}-panel-${key}`;

/** Gera um baseId estável para SettingsTabs. */
export function useTabsBaseId() {
  return useId().replace(/:/g, "");
}
