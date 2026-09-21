import { cn } from "@/lib/utils";
import type { Tone } from "@/components/ui/StatusBadge";

const FILL: Record<Tone | "brand", string> = {
  brand: "bg-wg-green",
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-neutral",
};

interface Props {
  /** 0–100. Valores fora da faixa são limitados. */
  value: number;
  /** Descrição para leitores de tela, ex.: "Progresso da admissão". */
  label: string;
  tone?: Tone | "brand";
  size?: "xs" | "sm";
  className?: string;
}

/** Barra de progresso discreta (4–6px), acessível via role="progressbar". */
export function ProgressBar({ value, label, tone = "brand", size = "sm", className }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "w-full overflow-hidden rounded-full bg-[#EDF1E8]",
        size === "xs" ? "h-1" : "h-1.5",
        className
      )}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", FILL[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
