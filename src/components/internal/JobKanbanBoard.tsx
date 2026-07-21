"use client";

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
import {
  KanbanBoardShell,
  type KanbanColumnDef,
} from "@/components/internal/KanbanBoardShell";

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

const STATUSES: KanbanColumnDef[] = [
  { key: "DRAFT", label: "Rascunho", dot: "bg-blue-400" },
  { key: "ACTIVE", label: "Ativa", dot: "bg-wg-green" },
  { key: "SCREENING", label: "Triagem", dot: "bg-amber-400" },
  { key: "INTERVIEW", label: "Entrevistas", dot: "bg-purple-400" },
  { key: "ADMISSION", label: "Admissão", dot: "bg-cyan-400" },
  { key: "PAUSED", label: "Pausada", dot: "bg-orange-400" },
  { key: "CLOSED", label: "Cancelada", dot: "bg-wg-gray" },
  { key: "FILLED", label: "Finalizada", dot: "bg-emerald-500" },
];

export function JobKanbanBoard({ jobs, canManage }: Props) {
  return (
    <KanbanBoardShell<KanbanJob>
      initialItems={jobs}
      columns={STATUSES}
      canManage={canManage}
      getId={(j) => j.id}
      getColumn={(j) => j.status}
      applyColumn={(j, status) => ({ ...j, status })}
      onMove={(id, status) =>
        fetch(`/api/jobs/${id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
      }
      moveSuccess={(j, label) => `"${j.title}" movida para ${label}.`}
      moveError="Erro ao mudar o status da vaga."
      emptyLabel="Nenhuma vaga"
      renderCard={(j) => (
        <>
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
                <span className="ml-1 font-medium text-amber-700">· parada</span>
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
        </>
      )}
    />
  );
}
