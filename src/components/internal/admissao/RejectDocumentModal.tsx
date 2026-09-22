"use client";

import { useEffect, useId, useRef, useState } from "react";
import { XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const QUICK_REASONS = ["Ilegível ou cortado", "Documento errado", "Documento vencido", "Falta frente ou verso"];

interface Props {
  /** Nome do documento sendo recusado; null fecha o modal. */
  documentName: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Recusa manual de documento — motivo obrigatório (fica registrado e visível para o RH). */
export function RejectDocumentModal({ documentName, onConfirm, onCancel }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const isOpen = documentName !== null;
  useEffect(() => {
    if (!isOpen) return;
    setReason("");
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (!isOpen) return null;
  const valid = reason.trim().length >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1A2213]/60" onClick={onCancel} aria-hidden />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onConfirm(reason.trim());
        }}
        className="relative w-full max-w-md rounded-card border border-wg-border-lighter bg-white p-6 shadow-[0_24px_48px_rgba(26,34,19,.2)]"
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-control bg-danger-bg text-danger-fg">
          <XCircle className="h-5 w-5" aria-hidden />
        </div>
        <h3 id={titleId} className="mb-1 font-sora text-base font-semibold text-wg-ink">
          Recusar documento
        </h3>
        <p className="mb-4 text-body text-wg-ink-muted">{documentName}</p>

        <label className="mb-1.5 block text-label text-wg-ink-muted" htmlFor={`${titleId}-reason`}>
          Motivo da recusa
        </label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                reason === r
                  ? "border-danger-fg bg-danger-bg text-danger-fg"
                  : "border-wg-border-light bg-white text-wg-ink-muted hover:border-wg-ink-muted"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          id={`${titleId}-reason`}
          ref={inputRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Ex.: foto tremida, não dá para ler o número do documento"
          className="mb-5 w-full rounded-control border border-wg-border-light px-3 py-2 text-body text-wg-ink focus:border-wg-green-dark focus:outline-none focus:ring-2 focus:ring-wg-green/30"
        />

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className={buttonVariants({ variant: "secondary", className: "flex-1" })}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-control bg-danger px-3.5 text-sm font-semibold text-white transition-colors hover:bg-danger-fg disabled:opacity-50"
          >
            Recusar
          </button>
        </div>
      </form>
    </div>
  );
}
