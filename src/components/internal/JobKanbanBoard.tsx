"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Users, Pencil } from "lucide-react";
import {
  MODALITY_LABELS,
  STALE_JOB_DAYS,
  formatAge,
  daysSince,
  isPublicJobStatus,
} from "@/lib/utils";
import { PriorityBadge } from "@/components/internal/PriorityBadge";

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
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moveTo(jobId: string, status: string) {
    const job = items.find((j) => j.id === jobId);
    if (!job || job.status === status) return;

    const prev = items;
    setItems((list) => list.map((j) => (j.id === jobId ? { ...j, status } : j)));
    setError(null);

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
        setError(typeof data.error === "string" ? data.error : "Erro ao mudar o status da vaga.");
      }
    } catch {
      setItems(prev);
      setError("Erro de conexão. Tente novamente.");
    }
  }

  return (
    <>
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((col) => {
          const cards = items.filter((j) => j.status === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                if (!canManage || !dragId) return;
                e.preventDefault();
                setOverStatus(col.key);
              }}
              onDragLeave={() => setOverStatus((s) => (s === col.key ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOverStatus(null);
                if (canManage && dragId) moveTo(dragId, col.key);
                setDragId(null);
              }}
              className={`shrink-0 w-72 rounded-xl border transition-colors ${
                overStatus === col.key
                  ? "border-wg-green bg-wg-green/5"
                  : "border-gray-200 bg-gray-100"
              }`}
            >
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
                  <div
                    key={j.id}
                    draggable={canManage}
                    onDragStart={() => setDragId(j.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`bg-white border border-gray-200 shadow-sm rounded-lg p-3 ${
                      canManage ? "cursor-grab active:cursor-grabbing" : ""
                    } ${dragId === j.id ? "opacity-50" : ""}`}
                  >
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
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
