"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, XCircle } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type Props = {
  jobId: string;
  jobTitle: string;
  status: string;
};

type ConfirmAction = "cancel" | "delete" | null;

export function JobActions({ jobId, jobTitle, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<ConfirmAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmAction>(null);

  async function execute(action: "cancel" | "delete") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        credentials: "same-origin",
        headers: action === "cancel" ? { "Content-Type": "application/json" } : undefined,
        body: action === "cancel" ? JSON.stringify({ status: "CLOSED" }) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erro ao executar ação.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          {status !== "CLOSED" && (
            <button
              onClick={() => setPendingAction("cancel")}
              disabled={loading !== null}
              title="Encerrar vaga"
              className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setPendingAction("delete")}
            disabled={loading !== null}
            title="Excluir vaga permanentemente"
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <ConfirmModal
        isOpen={pendingAction === "cancel"}
        title={`Encerrar vaga?`}
        message={`"${jobTitle}" ficará encerrada e deixará de aparecer no portal público.`}
        confirmLabel="Sim, encerrar"
        variant="warning"
        onConfirm={() => { setPendingAction(null); execute("cancel"); }}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmModal
        isOpen={pendingAction === "delete"}
        title="Excluir vaga permanentemente?"
        message={`"${jobTitle}" será removida e esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        variant="danger"
        onConfirm={() => { setPendingAction(null); execute("delete"); }}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}
