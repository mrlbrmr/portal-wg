"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Props {
  userId: string;
  currentRole: string;
  isActive: boolean;
}

export function UserToggleActions({ userId, currentRole, isActive }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  async function patch(data: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d.error === "string" ? d.error : "Erro ao atualizar.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Alternar papel */}
        <button
          onClick={() =>
            patch({ role: currentRole === "ADMIN_RH" ? "VIEWER_RH" : "ADMIN_RH" })
          }
          disabled={loading}
          className="text-xs border border-gray-300 hover:border-wg-green text-gray-600 hover:text-wg-green-dark px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {currentRole === "ADMIN_RH" ? "→ Visualizador" : "→ Admin RH"}
        </button>

        {/* Ativar / desativar */}
        {isActive ? (
          <button
            onClick={() => setConfirmDeactivate(true)}
            disabled={loading}
            className="text-xs border border-gray-300 hover:border-red-400 text-gray-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            Desativar
          </button>
        ) : (
          <button
            onClick={() => patch({ active: true })}
            disabled={loading}
            className="text-xs border border-gray-300 hover:border-wg-green text-gray-600 hover:text-wg-green-dark px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            Reativar
          </button>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <ConfirmModal
        isOpen={confirmDeactivate}
        title="Desativar usuário?"
        message="O usuário não conseguirá mais fazer login no painel. Você poderá reativar a conta a qualquer momento."
        confirmLabel="Sim, desativar"
        variant="warning"
        onConfirm={() => { setConfirmDeactivate(false); patch({ active: false }); }}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </>
  );
}
