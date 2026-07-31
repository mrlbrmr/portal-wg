"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  XCircle,
  CheckCircle2,
  Trash2,
  Loader2,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";

interface Props {
  jobId: string;
  jobTitle: string;
  status: string;
}

type ConfirmAction = "cancel" | "finish" | "delete" | null;

/**
 * Menu de ações (kebab "…") por vaga na tela de gerenciamento. Consolida
 * Editar, Duplicar, Cancelar e Excluir num único dropdown, substituindo os
 * botões soltos que poluíam o card. Só é renderizado para quem pode gerenciar.
 */
export function JobActionsMenu({ jobId, jobTitle, status }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"duplicate" | ConfirmAction>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmAction>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora ou pressionar Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function duplicate() {
    setLoading("duplicate");
    try {
      const res = await fetch(`/api/jobs/${jobId}/duplicate`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify("error", typeof data.error === "string" ? data.error : "Erro ao duplicar a vaga.");
        return;
      }
      const newJob = await res.json();
      notify("success", "Vaga duplicada. Ajuste os dados e publique.");
      router.push(`/vagas/${newJob.id}/editar`);
    } catch {
      notify("error", "Erro de conexão ao duplicar.");
    } finally {
      setLoading(null);
    }
  }

  async function execute(action: "cancel" | "finish" | "delete") {
    setLoading(action);
    const newStatus = action === "cancel" ? "CLOSED" : action === "finish" ? "FILLED" : null;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        credentials: "same-origin",
        headers: newStatus ? { "Content-Type": "application/json" } : undefined,
        body: newStatus ? JSON.stringify({ status: newStatus }) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify("error", typeof data.error === "string" ? data.error : "Erro ao executar a ação.");
        return;
      }
      notify(
        "success",
        action === "cancel"
          ? `"${jobTitle}" foi cancelada.`
          : action === "finish"
          ? `"${jobTitle}" foi finalizada.`
          : `"${jobTitle}" foi excluída.`
      );
      router.refresh();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;
  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50";

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Mais ações"
          className="rounded-lg border border-gray-300 p-1.5 text-gray-500 transition-colors hover:border-wg-green hover:text-wg-green-dark disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            <Link
              href={`/vagas/${jobId}/editar`}
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <Pencil className="h-4 w-4 text-gray-400" />
              Editar
            </Link>
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                duplicate();
              }}
            >
              <Copy className="h-4 w-4 text-gray-400" />
              Duplicar
            </button>

            <div className="my-1 border-t border-gray-100" />

            {status !== "FILLED" && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-700 transition-colors hover:bg-emerald-50"
                onClick={() => {
                  setOpen(false);
                  setPendingAction("finish");
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Finalizar vaga
              </button>
            )}
            {status !== "CLOSED" && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-700 transition-colors hover:bg-amber-50"
                onClick={() => {
                  setOpen(false);
                  setPendingAction("cancel");
                }}
              >
                <XCircle className="h-4 w-4" />
                Cancelar vaga
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
              onClick={() => {
                setOpen(false);
                setPendingAction("delete");
              }}
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={pendingAction === "cancel"}
        title="Cancelar vaga?"
        message={`"${jobTitle}" será marcada como Cancelada e deixará de aparecer no portal público.`}
        confirmLabel="Sim, cancelar"
        variant="warning"
        onConfirm={() => {
          setPendingAction(null);
          execute("cancel");
        }}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmModal
        isOpen={pendingAction === "finish"}
        title="Finalizar vaga?"
        message={`"${jobTitle}" será marcada como Finalizada, sairá do portal público e passará a contar nos indicadores de vagas concluídas.`}
        confirmLabel="Sim, finalizar"
        variant="warning"
        onConfirm={() => {
          setPendingAction(null);
          execute("finish");
        }}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmModal
        isOpen={pendingAction === "delete"}
        title="Excluir vaga permanentemente?"
        message={`"${jobTitle}" será removida e esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        variant="danger"
        onConfirm={() => {
          setPendingAction(null);
          execute("delete");
        }}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}
