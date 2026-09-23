"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Gráficos leves do painel (sem biblioteca): colunas para séries temporais e barras
 * horizontais para distribuições. Marcas finas, topo arredondado (4px) apoiado na base,
 * grade discreta e tooltip por marca no hover/foco (cada coluna é focável e rotulada).
 * Uma série só = sem legenda (o título do painel nomeia a série).
 */

export interface ColumnDatum {
  key: string;
  /** Rótulo curto do eixo ("set"). */
  label: string;
  /** Rótulo completo do tooltip ("setembro de 2026"). */
  fullLabel: string;
  value: number;
}

/** Topo "redondo" do eixo: 1, 2, 5 × 10ⁿ acima do máximo. */
function niceMax(max: number): number {
  if (max <= 4) return Math.max(1, max);
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

export function ColumnChart({
  data,
  unit = ["item", "itens"],
  height = 208,
  ariaLabel,
}: {
  data: ColumnDatum[];
  /** Singular/plural da unidade no tooltip e na tabela ("admissão", "admissões"). */
  unit?: [string, string];
  height?: number;
  ariaLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, max / 2, max];
  const peak = Math.max(...data.map((d) => d.value));
  const lastKey = data[data.length - 1]?.key;
  const fmtUnit = (n: number) => `${n.toLocaleString("pt-BR")} ${n === 1 ? unit[0] : unit[1]}`;

  return (
    <figure className="m-0">
      <div className="flex gap-2" style={{ height }} role="group" aria-label={ariaLabel}>
        {/* Eixo Y */}
        <div aria-hidden className="relative w-7 shrink-0 text-right text-[11px] tabular-nums text-wg-ink-muted">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / max) * 100}%` }}>
              {t.toLocaleString("pt-BR")}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Grade */}
          {ticks.map((t) => (
            <span
              aria-hidden
              key={t}
              className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-wg-border-light" : "bg-wg-border-lighter/70")}
              style={{ top: `${100 - (t / max) * 100}%` }}
            />
          ))}

          <div className="relative flex h-full items-end gap-[2px]">
            {data.map((d) => {
              const pct = max > 0 ? (d.value / max) * 100 : 0;
              const isActive = active === d.key;
              const showLabel = d.value > 0 && (d.key === lastKey || d.value === peak);
              return (
                <div
                  key={d.key}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.fullLabel}: ${fmtUnit(d.value)}`}
                  onMouseEnter={() => setActive(d.key)}
                  onMouseLeave={() => setActive((k) => (k === d.key ? null : k))}
                  onFocus={() => setActive(d.key)}
                  onBlur={() => setActive((k) => (k === d.key ? null : k))}
                  className="group relative flex h-full flex-1 cursor-default items-end justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
                >
                  {/* Faixa de hover (alvo maior que a marca) */}
                  <span className={cn("absolute inset-0 rounded-md transition-colors", isActive && "bg-wg-hover-light/50")} />
                  <span
                    className={cn(
                      "relative w-full max-w-[44px] rounded-t-[4px] transition-colors",
                      isActive ? "bg-wg-green-dark" : "bg-[#6E9440]"
                    )}
                    style={{ height: `${pct}%`, minHeight: d.value > 0 ? 3 : 0 }}
                  >
                    {showLabel && !isActive && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11.5px] font-semibold tabular-nums text-wg-ink-secondary">
                        {d.value}
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute z-10 w-max max-w-[180px] -translate-x-1/2 rounded-control bg-wg-ink px-2.5 py-1.5 text-left text-[12px] leading-snug text-white shadow-lg"
                      style={{ left: "50%", bottom: `calc(${Math.max(pct, 0)}% + 8px)` }}
                    >
                      <span className="block capitalize text-white/70">{d.fullLabel}</span>
                      <span className="block font-semibold tabular-nums">{fmtUnit(d.value)}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Eixo X */}
      <div className="mt-1.5 flex gap-2" aria-hidden>
        <div className="w-7 shrink-0" />
        <div className="flex min-w-0 flex-1 gap-[2px]">
          {data.map((d) => (
            <span key={d.key} className="flex-1 truncate text-center text-[11.5px] capitalize text-wg-ink-muted">
              {d.label}
            </span>
          ))}
        </div>
      </div>

    </figure>
  );
}

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Cor de identidade vinda do cadastro (ex.: cor da etapa). */
  color?: string | null;
  href?: string;
}

/**
 * Distribuição em barras horizontais (etapa, empresa, filial): rótulo e número em tinta
 * de texto; a barra (fina, cor da entidade) mostra a proporção sobre o total.
 */
export function BarList({
  data,
  total,
  emptyText = "Não existem dados suficientes para este filtro.",
  maxItems,
}: {
  data: BarDatum[];
  total: number;
  emptyText?: string;
  /** Mostra só os N maiores e agrupa o restante em "Outros". */
  maxItems?: number;
}) {
  if (data.length === 0 || total === 0) {
    return <p className="py-8 text-center text-meta text-wg-ink-muted">{emptyText}</p>;
  }
  let rows = data;
  if (maxItems && data.length > maxItems) {
    const head = data.slice(0, maxItems - 1);
    const rest = data.slice(maxItems - 1).reduce((s, d) => s + d.value, 0);
    rows = [...head, { key: "__outros", label: `Outros (${data.length - head.length})`, value: rest, color: "#B5BEAA" }];
  }
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
        return (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-meta">
              <span className="flex min-w-0 items-center gap-2 text-wg-ink-secondary" title={r.label}>
                {r.color && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />}
                <span className="truncate">{r.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-wg-ink">{r.value}</span>
                <span className="ml-1.5 text-[12px] text-wg-ink-muted">{pct}%</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-wg-bg" aria-hidden>
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color ?? "#6E9440" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
