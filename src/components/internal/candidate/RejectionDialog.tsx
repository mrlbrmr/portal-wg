"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DialogShell } from "./DialogShell";

// Motivos exibidos no select. Não há coluna estruturada de motivo no banco: o motivo
// escolhido é registrado como texto nas anotações da candidatura (campo `notes`), junto
// com a observação. Um relatório por motivo exige coluna própria (dependência futura).
export const REJECTION_REASONS = [
  "Perfil não atende aos requisitos da vaga",
  "Experiência insuficiente",
  "Pretensão salarial incompatível",
  "Localização ou disponibilidade incompatível",
  "Não compareceu / sem retorno",
  "Desistência do candidato",
  "Não aprovado em teste ou entrevista",
  "Vaga preenchida por outro candidato",
  "Outro motivo",
] as const;

/** Bloco anexado às anotações: "Reprovação em 21/09/2026 — Motivo: … Observação: …". */
export function buildRejectionNote(reason: string, note: string, at: Date = new Date()): string {
  const date = at.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const obs = note.trim();
  return `Reprovação em ${date} — Motivo: ${reason}.${obs ? ` Observação: ${obs}` : ""}`;
}

interface Props {
  open: boolean;
  candidateName: string;
  /** Nome da etapa de reprovação configurada no funil (kind=LOST). */
  targetStageName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, note: string) => void;
}

export function RejectionDialog({ open, candidateName, targetStageName, busy, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setNote("");
      setTouched(false);
    }
  }, [open]);

  const invalid = !reason;
  const submit = () => {
    setTouched(true);
    if (invalid) return;
    onConfirm(reason, note);
  };

  return (
    <DialogShell
      open={open}
      tone="danger"
      title="Reprovar candidatura?"
      description={
        <>
          <strong className="font-semibold text-wg-ink">{candidateName}</strong> será movido(a) para “{targetStageName}” e
          sai do funil ativo. Você pode reabrir a candidatura depois.
        </>
      }
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            aria-busy={busy || undefined}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-control bg-danger px-3.5 text-sm font-semibold text-white transition-colors hover:bg-danger-fg disabled:opacity-50"
          >
            {busy ? "Reprovando…" : "Confirmar reprovação"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="rejection-reason" className="mb-1 block text-label text-wg-ink">
            Motivo da reprovação <span className="text-danger-fg">*</span>
          </label>
          <select
            id="rejection-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={touched && invalid}
            aria-describedby={touched && invalid ? "rejection-reason-error" : undefined}
            className="h-9 w-full rounded-control border border-wg-border-light bg-white px-2.5 text-body text-wg-ink outline-none focus:border-wg-green focus:ring-2 focus:ring-wg-green/30 aria-[invalid=true]:border-danger"
          >
            <option value="">Selecione um motivo</option>
            {REJECTION_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {touched && invalid && (
            <p id="rejection-reason-error" className="mt-1 text-meta text-danger-fg">
              Selecione o motivo para continuar.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="rejection-note" className="mb-1 block text-label text-wg-ink">
            Observação interna
          </label>
          <textarea
            id="rejection-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Contexto para a equipe (opcional)"
            className="w-full resize-y rounded-control border border-wg-border-light bg-white px-2.5 py-2 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30"
          />
          <p className="mt-1 text-meta text-wg-ink-muted">
            O motivo e a observação ficam registrados nas anotações da equipe. O candidato não é notificado.
          </p>
        </div>
      </div>
    </DialogShell>
  );
}
