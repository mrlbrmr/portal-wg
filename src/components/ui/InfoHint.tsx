"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Texto da explicação — lido por leitores de tela e exibido no hover/foco. */
  text: string;
  /** Rótulo do botão para leitores de tela (ex.: "Sobre a aderência"). */
  label?: string;
  align?: "left" | "center" | "right";
  className?: string;
}

/**
 * Ícone (i) com tooltip acessível: abre no hover, no foco por teclado e no toque; Esc
 * fecha. O texto também fica ligado ao botão por aria-describedby.
 */
export function InfoHint({ text, label = "Mais informações", align = "center", className }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className={cn("relative inline-flex", className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-wg-ink-muted transition-colors hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-30 mt-1.5 w-64 rounded-control bg-wg-ink px-2.5 py-2 text-[12px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg transition-opacity",
          align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2",
          open ? "opacity-100" : "sr-only opacity-0"
        )}
      >
        {text}
      </span>
    </span>
  );
}
