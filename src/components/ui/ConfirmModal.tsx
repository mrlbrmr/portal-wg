"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação para ações destrutivas ou irreversíveis. Diálogo modal acessível:
 * foco inicial em "Cancelar" (a opção segura), Esc cancela, clique fora cancela.
 */
export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmar",
  variant = "danger",
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Ref para não reexecutar o efeito (e roubar o foco) quando o pai recria onCancel.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1A2213]/60" onClick={onCancel} aria-hidden />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-sm rounded-card border border-wg-border-lighter bg-white p-6 shadow-[0_24px_48px_rgba(26,34,19,.2)]"
      >
        <div
          className={cn(
            "mb-4 flex h-10 w-10 items-center justify-center rounded-control",
            variant === "danger" ? "bg-danger-bg text-danger-fg" : "bg-warning-bg text-warning-fg"
          )}
        >
          {variant === "danger" ? <Trash2 className="h-5 w-5" aria-hidden /> : <AlertTriangle className="h-5 w-5" aria-hidden />}
        </div>

        <h3 id={titleId} className="mb-2 font-sora text-base font-semibold text-wg-ink">
          {title}
        </h3>
        <p id={descId} className="mb-6 text-body text-wg-ink-muted">
          {message}
        </p>

        <div className="flex gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className={buttonVariants({ variant: "secondary", className: "flex-1" })}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center rounded-control px-3.5 text-sm font-semibold transition-colors",
              variant === "danger"
                ? "bg-danger text-white hover:bg-danger-fg"
                : "bg-warning-bg text-warning-fg border border-warning-border hover:bg-[#F8E6C3]"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
