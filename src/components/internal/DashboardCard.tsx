import Link from "next/link";
import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { TONE_SOFT, type Tone } from "@/components/ui/StatusBadge";

interface Props {
  label: string;
  value: string | number;
  icon: ElementType;
  /** Tom semântico do ícone. Default: neutral. */
  tone?: Tone;
  /** Texto auxiliar abaixo do rótulo (ex.: contexto ou período). */
  hint?: string;
  /** Se informado, o card inteiro vira um link para esse destino. */
  href?: string;
}

/**
 * Card de métrica do Dashboard (páginas operacionais usam <CompactMetrics>).
 * Horizontal e baixo: ícone à esquerda, número + rótulo à direita.
 */
export function DashboardCard({ label, value, icon: Icon, tone = "neutral", hint, href }: Props) {
  const inner = (
    <>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-control", TONE_SOFT[tone])}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-sora text-xl font-semibold leading-tight tabular-nums text-wg-ink">{value}</span>
        <span className="block truncate text-meta text-wg-ink-muted">{label}</span>
        {hint && <span className="block truncate text-[11.5px] text-wg-ink-muted/80">{hint}</span>}
      </span>
    </>
  );

  const base = "flex items-center gap-3 rounded-card border border-wg-border-lighter bg-white px-4 py-3";

  if (href) {
    return (
      <Link href={href} className={cn(base, "transition-colors hover:border-wg-green/60 hover:bg-[#FBFCF9]")}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}
