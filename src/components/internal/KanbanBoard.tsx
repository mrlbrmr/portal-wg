"use client";

import { useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { Download, Mail, Phone, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDate } from "@/lib/utils";
import {
  KanbanColumn,
  KanbanCard,
  useKanbanSensors,
} from "@/components/internal/kanban-dnd";

export interface KanbanApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  resumeName: string | null;
  stage: string;
  createdAt: string; // ISO
}

interface Props {
  applications: KanbanApplication[];
  canManage: boolean;
}

const STAGES: { key: string; label: string; dot: string }[] = [
  { key: "NEW", label: "Novo", dot: "bg-blue-400" },
  { key: "SCREENING", label: "Triagem", dot: "bg-amber-400" },
  { key: "INTERVIEW", label: "Entrevista", dot: "bg-purple-400" },
  { key: "OFFER", label: "Proposta", dot: "bg-cyan-400" },
  { key: "HIRED", label: "Contratado", dot: "bg-wg-green" },
  { key: "REJECTED", label: "Reprovado", dot: "bg-red-400" },
];

export function KanbanBoard({ applications, canManage }: Props) {
  const [apps, setApps] = useState(applications);
  const { notify } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const sensors = useKanbanSensors();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over) moveTo(String(active.id), String(over.id));
  }

  async function moveTo(appId: string, stage: string) {
    const app = apps.find((a) => a.id === appId);
    if (!app || app.stage === stage) return;

    const prev = apps;
    setApps((list) => list.map((a) => (a.id === appId ? { ...a, stage } : a)));

    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        setApps(prev); // reverte
        const data = await res.json().catch(() => ({}));
        notify("error", typeof data.error === "string" ? data.error : "Erro ao mover candidatura.");
        return;
      }
      const label = STAGES.find((s) => s.key === stage)?.label ?? stage;
      notify("success", `${app.fullName} movido para ${label}.`);
    } catch {
      setApps(prev);
      notify("error", "Erro de conexão. Tente novamente.");
    }
  }

  async function remove(appId: string) {
    const removed = apps.find((a) => a.id === appId);
    const prev = apps;
    setApps((list) => list.filter((a) => a.id !== appId));
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setApps(prev);
        const data = await res.json().catch(() => ({}));
        notify("error", typeof data.error === "string" ? data.error : "Erro ao excluir candidatura.");
        return;
      }
      notify("success", `Candidatura de ${removed?.fullName ?? "candidato"} excluída.`);
    } catch {
      setApps(prev);
      notify("error", "Erro de conexão. Tente novamente.");
    }
  }

  const deleting = apps.find((a) => a.id === deleteId);

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((col) => {
            const cards = apps.filter((a) => a.stage === col.key);
            return (
              <KanbanColumn key={col.key} id={col.key}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-semibold text-gray-900">{col.label}</span>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                    {cards.length}
                  </span>
                </div>

                <div className="p-2 flex flex-col gap-2 min-h-[120px]">
                  {cards.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6">Nenhuma candidatura</p>
                  )}

                  {cards.map((a) => (
                    <KanbanCard key={a.id} id={a.id} draggable={canManage} className="group">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.fullName}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {formatDate(a.createdAt)}
                        </p>
                      </div>

                      <div className="mt-2 flex flex-col gap-1">
                        <a
                          href={`mailto:${a.email}`}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-wg-green-dark transition-colors truncate"
                        >
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{a.email}</span>
                        </a>
                        <a
                          href={`tel:${a.phone.replace(/\D/g, "")}`}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-wg-green-dark transition-colors"
                        >
                          <Phone className="w-3 h-3 shrink-0" />
                          {a.phone}
                        </a>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        {a.resumeName ? (
                          <a
                            href={`/api/applications/${a.id}/resume`}
                            className="inline-flex items-center gap-1 text-xs text-wg-green-dark hover:opacity-80 font-medium transition-opacity"
                          >
                            <Download className="w-3 h-3" />
                            Currículo
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Sem currículo</span>
                        )}
                        {canManage && (
                          <button
                            onClick={() => setDeleteId(a.id)}
                            title="Excluir candidatura"
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </KanbanCard>
                  ))}
                </div>
              </KanbanColumn>
            );
          })}
        </div>
      </DndContext>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="Excluir candidatura?"
        message={
          deleting
            ? `A candidatura de "${deleting.fullName}" e o currículo serão removidos permanentemente (LGPD). Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Sim, excluir"
        variant="danger"
        onConfirm={() => {
          if (deleteId) remove(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
