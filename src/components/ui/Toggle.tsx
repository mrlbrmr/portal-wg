import type { ElementType } from "react";
import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Texto do estado ao lado do trilho, ex.: ["Exibido", "Oculto"] — reforça a cor. */
  stateLabels?: [on: string, off: string];
  /** Ícone lucide antes do rótulo. */
  icon?: ElementType;
}

/**
 * Interruptor liga/desliga. É um checkbox nativo (role="switch") dentro do <label>:
 * clique no texto também alterna, Espaço alterna pelo teclado e o foco fica visível
 * no trilho. Com `stateLabels`, o estado também aparece em texto — não só pela cor.
 */
export function Toggle({ checked, onChange, label, description, disabled = false, stateLabels, icon: Icon }: ToggleProps) {
  return (
    <label className={cn("group flex items-center justify-between gap-4 py-2.5", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-wg-ink-muted" aria-hidden />}
        <div className="min-w-0">
          <span className="select-none text-body leading-snug text-wg-ink">{label}</span>
          {description && <span className="mt-0.5 block text-meta text-wg-ink-muted">{description}</span>}
        </div>
      </div>
      {stateLabels && (
        <span className="w-14 shrink-0 text-right text-label text-wg-ink-muted" aria-hidden>
          {checked ? stateLabels[0] : stateLabels[1]}
        </span>
      )}
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
      />
      <div
        className={cn(
          "relative h-[22px] w-10 shrink-0 rounded-full transition-colors duration-200",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-wg-green/50 peer-focus-visible:ring-offset-2",
          checked ? "bg-wg-green" : "bg-gray-200 group-hover:bg-gray-300",
          disabled && "opacity-60"
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[18px]" : "translate-x-0"
          )}
        />
      </div>
    </label>
  );
}
