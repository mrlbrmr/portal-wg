"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Linha de contexto abaixo do título (ex.: "Motorista · Matriz - SJP"). */
  subtitle?: ReactNode;
  /** Elemento à esquerda do título (ícone do tipo, avatar). */
  leading?: ReactNode;
  children: ReactNode;
  /** Ações no rodapé — a principal por último. */
  footer?: ReactNode;
  size?: "sm" | "md";
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const WIDTHS = { sm: "max-w-[420px]", md: "max-w-[520px]" } as const;

/**
 * Painel lateral de detalhes (evento do calendário, registro de atividade). Mesmo padrão
 * do drawer de talentos: foco preso, Esc e clique fora fecham, o foco volta para quem
 * abriu e a página não rola por baixo. Tela cheia no celular.
 */
export function SideDrawer({ open, onClose, title, subtitle, leading, children, footer, size = "sm" }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeRef.current?.focus());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      // Diálogo aberto por cima (confirmação): as teclas são dele.
      if (e.defaultPrevented || document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (previous?.isConnected) previous.focus?.();
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-[#1A2213]/40 animate-fade-in [animation-duration:150ms]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex h-full w-full flex-col bg-white shadow-[-12px_0_40px_rgba(26,34,19,.18)] animate-panel-in sm:border-l sm:border-wg-border-lighter",
          WIDTHS[size]
        )}
      >
        <header className="flex items-start gap-3 border-b border-wg-border-lighter px-5 py-4">
          {leading && <div className="shrink-0">{leading}</div>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-sora text-base font-semibold leading-snug text-wg-ink">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-meta text-wg-ink-muted">{subtitle}</div>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-control text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-wg-border-lighter px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Lista de pares rótulo/valor usada dentro de drawers ("Tipo", "Data", "Responsável"). */
export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode } | null | false> }) {
  const rows = items.filter(Boolean) as Array<{ label: string; value: ReactNode }>;
  return (
    <dl className="divide-y divide-wg-border-lighter">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[120px_1fr] gap-3 py-2.5">
          <dt className="text-meta text-wg-ink-muted">{r.label}</dt>
          <dd className="min-w-0 break-words text-body text-wg-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
