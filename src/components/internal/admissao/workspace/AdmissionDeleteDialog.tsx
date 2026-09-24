"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { inputClass } from "./fields";

const CONFIRM_WORD = "EXCLUIR";

/**
 * Exclusão com confirmação forte: o RH digita EXCLUIR. É um soft-delete (DELETE da API
 * existente): a admissão some das listas, mas documentos e histórico ficam guardados.
 */
export function AdmissionDeleteDialog({
  admissionId,
  name,
  open,
  onClose,
}: {
  admissionId: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = typed.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    if (busy) return;
    setTyped("");
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admissoes/${admissionId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Não foi possível excluir a admissão.");
        return;
      }
      notify("success", "Admissão excluída.");
      router.push("/admissoes");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      alert
      busy={busy}
      size="sm"
      title="Excluir admissão?"
      description={`A admissão de ${name} sai das listas, do Kanban, do calendário e dos relatórios. Somente o suporte consegue restaurá-la.`}
      initialFocus="#adm-delete-confirm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" icon={Trash2} loading={busy} disabled={!ok} onClick={confirm}>
            Excluir admissão
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
      >
        <label htmlFor="adm-delete-confirm" className="mb-1 block text-[13px] font-medium text-wg-ink-secondary">
          Para confirmar, digite <strong className="font-semibold text-wg-ink">{CONFIRM_WORD}</strong>
        </label>
        <input
          id="adm-delete-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
        {error && (
          <p role="alert" className="mt-2 text-meta font-medium text-danger-fg">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
