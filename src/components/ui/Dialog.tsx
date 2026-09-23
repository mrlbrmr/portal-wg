"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Botões do rodapé — a ação principal por último. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** role="alertdialog" para confirmações destrutivas. */
  alert?: boolean;
  /** Seletor do elemento que recebe o foco ao abrir (padrão: primeiro campo/botão). */
  initialFocus?: string;
  /** Impede fechar por Esc/clique fora (ex.: enquanto salva). */
  busy?: boolean;
  className?: string;
}

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-5xl" } as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal acessível do painel: foco preso dentro do diálogo, Esc e clique fora
 * fecham, e o foco volta ao elemento que abriu. Para confirmações simples de uma
 * frase, prefira <ConfirmModal>.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  alert = false,
  initialFocus,
  busy = false,
  className,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first =
      (initialFocus ? panel?.querySelector<HTMLElement>(initialFocus) : null) ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, initialFocus]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[#1A2213]/60" onClick={() => !busy && onClose()} aria-hidden />
      <div
        ref={panelRef}
        role={alert ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col rounded-t-card border border-wg-border-lighter bg-white shadow-[0_24px_48px_rgba(26,34,19,.2)] sm:rounded-card",
          SIZES[size],
          className
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-wg-border-lighter px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-sora text-base font-semibold text-wg-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-meta text-wg-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-control text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-wg-border-lighter px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
