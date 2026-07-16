"use client";

import { useState } from "react";
import Link from "next/link";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { ExternalLink, Users, Pencil } from "lucide-react";
import {
  MODALITY_LABELS,
  STALE_JOB_DAYS,
  formatAge,
  daysSince,
  isPublicJobStatus,
} from "@/lib/utils";
import { PriorityBadge } from "@/components/internal/PriorityBadge";
import { useToast } from "@/components/ui/ToastProvider";
import {
  KanbanColumn,
  KanbanCard,
  useKanbanSensors,
} from "@/components/internal/kanban-dnd";

export interface KanbanJob {
  id: string;
  title: string;
  city: string;
  state: string;
  modality: string;
  status: string;
  priority: string;
  createdAt: string; // ISO
  candidateCount: number;
}

interface Props {
  jobs: KanbanJob[];
  canManage: boolean;
}

const STATUSES: { key: string; label: string; dot: string }[] = [
  { key: "DRAFT", label: "Rascunho", dot: "bg-blue-400" },
  { key: "ACTIVE", label: "Ativa", dot: "bg-wg-green" },
  { key: "SCREENING", label: "Triagem", dot: "bg-amber-400" },
  { key: "INTERVIEW", label: "Entrevistas", dot: "bg-purple-400" },
  { key: "ADMISSION", label: "Admissão", dot: "bg-cyan-400" },
  { key: "PAUSED", label: "Pausada", dot: "bg-orange-400" },
  { key: "CLOSED", label: "Cancelada", dot: "bg-wg-gray" },
];

export function JobKanbanBoard({ jobs, canManage }: Props) {
  const [items, setItems] = useState(jobs);
  const { notify } = useToast();
  const sensors = useKanbanSensors();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over) moveTo(String(active.id), String(over.id));
  }

  async function moveTo(jobId: string, status: string) {
    const job = items.find((j) => j.id === jobId);
    if (!job || job.status === status) return;

    const prev = items;
    setItems((list) => list.map((j) => (j.id === jobId ? { ...j, status } : j)));

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setItems(prev);
        const data = await res.json().catch(() => ({}));
        notify("error", typeof data.error === "string" ? data.error : "Erro ao mudar o status da vaga.");
        return;
      }
      const label = STATUSES.find((s) => s.key === status)?.label ?? status;
      notify("success", `"${job.title}" movida para ${label}.`);
    } catch {
      setItems(prev);
      notify("error", "Erro de conexão. Tente novamente.");
    }
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map((col) => {
            const cards = items.filter((j) => j.status === col.key);
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
                    <p className="text-xs text-gray-400 text-center py-6">Nenhuma vaga</p>
                  )}

                  {cards.map((j) => (
                    <KanbanCard key={j.id} id={j.id} draggable={canManage}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 leading-snug">{j.title}</p>
                        <PriorityBadge priority={j.priority} className="shrink-0" />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {j.city}/{j.state} · {MODALITY_LABELS[j.modality]}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Criada {formatAge(j.createdAt)}
                        {isPublicJobStatus(j.status) &&
                          daysSince(j.createdAt) >= STALE_JOB_DAYS && (
                            <span className="ml-1 font-medium text-amber-700">
                              · parada
                            </span>
                          )}
                      </p>

                      <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                        <Link
                          href={`/vagas/${j.id}/candidatos`}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-wg-green-dark transition-colors"
                          title="Ver candidatos"
                        >
                          <Users className="w-3 h-3" />
                          {j.candidateCount}
                        </Link>
                        {isPublicJobStatus(j.status) && (
                          <Link
                            href={`/vagas/${j.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-wg-green-dark transition-colors"
                            title="Ver vaga pública"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Ver
                          </Link>
                        )}
                        {canManage && (
                          <Link
                            href={`/vagas/${j.id}/editar`}
                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-wg-green-dark transition-colors"
                            title="Editar vaga"
                          >
                            <Pencil className="w-3 h-3" />
                            Editar
                          </Link>
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
    </>
  );
}
