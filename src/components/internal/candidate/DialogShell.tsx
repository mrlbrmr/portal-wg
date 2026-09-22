"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  /** Bloqueia fechar (Esc/clique fora) enquanto a ação está em andamento. */
  busy?: boolean;
  children: ReactNode;
  footer: ReactNode;
  tone?: "default" | "danger";
  /** "wide": tabelas lado a lado (ex.: comparação de candidatos). */
  size?: "default" | "wide";
}

/**
 * Diálogo modal usado por cima do drawer do candidato. Foco inicial no primeiro campo,
 * Tab preso dentro do diálogo, Esc fecha (com preventDefault para o drawer não fechar
 * junto) e o foco volta para quem abriu.
 */
export function DialogShell({ open, title, description, onClose, busy, children, footer, tone = "default", size = "default" }: Props) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "select, textarea, input, [data-autofocus], button:not([aria-label='Fechar'])"
    );
    first?.focus();
    return () => previous?.focus?.();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (!busy) onCloseRef.current();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href]'
      )
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-[#1A2213]/50" onClick={() => !busy && onClose()} aria-hidden />
      <div
        ref={panelRef}
        role={tone === "danger" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          "relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-card border border-wg-border-lighter bg-white shadow-[0_24px_48px_rgba(26,34,19,.2)]",
          size === "wide" ? "max-w-5xl" : "max-w-md"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-wg-border-lighter px-5 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className={cn("font-sora text-base font-semibold", tone === "danger" ? "text-danger-fg" : "text-wg-ink")}>
              {title}
            </h3>
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
            className="rounded-control p-1 text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-wg-border-lighter px-5 py-3">{footer}</div>
      </div>
    </div>
  );
}
