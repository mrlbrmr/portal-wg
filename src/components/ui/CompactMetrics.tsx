import Link from "next/link";
import { cn } from "@/lib/utils";
import { TONE_DOT, TONE_TEXT, type Tone } from "@/components/ui/StatusBadge";

export interface CompactMetric {
  label: string;
  value: number | string;
  href?: string;
  /** Ponto colorido antes do rótulo — só quando o número tem conotação de estado. */
  tone?: Tone;
  /** Tooltip explicando como o número é calculado. */
  hint?: string;
  /**
   * Peso visual (opt-in). `strong`: número e rótulo na cor do tom — para o que pede ação
   * ("precisam de atenção"). `subtle`: número sem negrito — histórico (encerradas, canceladas).
   */
  weight?: "strong" | "subtle";
}

interface Props {
  /** Total em destaque à esquerda (ex.: "26 vagas"). */
  total: { value: number | string; label: string };
  items: CompactMetric[];
  /**
   * `card` (padrão): faixa com borda. `inline`: uma linha de texto sem moldura, logo abaixo do
   * título — para páginas em que a lista é a tarefa principal e o resumo não deve competir.
   */
  variant?: "card" | "inline";
  /** Zeros ficam sem ponto, sem negrito e no fim da linha (ênfase por exceção). */
  muteZero?: boolean;
  className?: string;
}

const isZero = (v: number | string) => v === 0 || v === "0";

/**
 * Faixa de métricas compacta para páginas operacionais (Vagas, Admissões): ocupa uma
 * linha em vez de uma grade de cards. Ex.: 26 vagas | 7 abertas · 1 rascunho · 4 canceladas.
 */
export function CompactMetrics({ total, items, variant = "card", muteZero = false, className }: Props) {
  // Ordenação estável: só empurra os zeros para o fim.
  const list = muteZero ? [...items.filter((m) => !isZero(m.value)), ...items.filter((m) => isZero(m.value))] : items;

  const renderItem = (m: CompactMetric) => {
    const muted = muteZero && isZero(m.value);
    const strong = !muted && m.weight === "strong";
    const valueClass = muted
      ? "text-wg-ink-muted"
      : strong && m.tone
        ? cn("font-semibold", TONE_TEXT[m.tone])
        : m.weight === "subtle"
          ? "font-medium text-wg-ink-secondary"
          : "font-semibold text-wg-ink";
    const inner = (
      <>
        {m.tone && !muted && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[m.tone])} />}
        <span className={cn("tabular-nums", valueClass)}>{m.value}</span>
        <span className={strong && m.tone ? cn("font-medium", TONE_TEXT[m.tone]) : "text-wg-ink-muted"}>{m.label}</span>
      </>
    );
    return m.href ? (
      <Link
        href={m.href}
        title={m.hint}
        className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 transition-colors duration-150 hover:bg-wg-hover-light"
      >
        {inner}
      </Link>
    ) : (
      <span title={m.hint} className="inline-flex items-center gap-1.5">
        {inner}
      </span>
    );
  };

  if (variant === "inline") {
    // Mesmo recurso do MetaLine da lista de vagas: todo item leva o "·" à esquerda e a linha é
    // deslocada dentro de um overflow oculto — o separador nunca abre uma linha quebrada.
    // O padding externo (p-1 / -m-1) deixa o contorno de foco dos links visível.
    const sep = (
      <span aria-hidden className="w-5 shrink-0 text-center text-wg-ink-muted/50">
        ·
      </span>
    );
    return (
      <div className={cn("-m-1 overflow-hidden p-1", className)}>
        <ul className="-ml-5 flex flex-wrap items-center gap-y-1 text-meta">
          <li className="flex items-baseline">
            {sep}
            <span className="flex items-baseline gap-1.5">
              <span className="font-sora text-[15px] font-semibold tabular-nums text-wg-ink">{total.value}</span>
              <span className="font-medium text-wg-ink-secondary">{total.label}</span>
            </span>
          </li>
          {list.map((m) => (
            <li key={m.label} className="flex items-center">
              {sep}
              {renderItem(m)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

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
        {list.map((m) => (
          <li key={m.label} className="text-meta">
            {renderItem(m)}
          </li>
        ))}
      </ul>
    </div>
  );
}
