"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, XCircle } from "lucide-react";

type Props = {
  jobId: string;
  jobTitle: string;
  status: string;
};

export function JobActions({ jobId, jobTitle, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"cancel" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!confirm(`Cancelar a vaga "${jobTitle}"?\n\nEla ficará encerrada e não aparecerá mais no portal.`)) return;
    setLoading("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erro ao cancelar vaga.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir permanentemente a vaga "${jobTitle}"?\n\nEsta ação não pode ser desfeita.`)) return;
    setLoading("delete");
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erro ao excluir vaga.");
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
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        {status !== "CLOSED" && (
          <button
            onClick={handleCancel}
            disabled={loading !== null}
            title="Cancelar vaga"
            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={loading !== null}
          title="Excluir vaga permanentemente"
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
