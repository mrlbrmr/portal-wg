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
  city: string | null;
  state: string | null;
  isTalentPool?: boolean;
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

// Faixa inferior colorida do card — mesma semântica visual do Kanban de candidatos
const PRIORITY_ACCENT: Record<string, string> = {
  LOW:    "#D1D5DB", // cinza-300 — baixa prioridade, quase invisível
  MEDIUM: "#D1D5DB", // idem — não distrai do conteúdo
  HIGH:   "#F59E0B", // âmbar-400 — sinaliza atenção
  URGENT: "#EF4444", // red-500 — ação imediata
};

const STATUSES: KanbanColumnDef[] = [
  { key: "DRAFT",     label: "Rascunho"    },
  { key: "ACTIVE",    label: "Ativa"       },
  { key: "SCREENING", label: "Triagem"     },
  { key: "INTERVIEW", label: "Entrevistas" },
  { key: "ADMISSION", label: "Admissão"    },
  { key: "PAUSED",    label: "Pausada"     },
  { key: "CLOSED",    label: "Cancelada"   },
  { key: "FILLED",    label: "Finalizada"  },
];

export function JobKanbanBoard({ jobs, canManage }: Props) {
  return (
    // mt-5 cria o respiro entre as pílulas de filtro/toolbar e o board
    <div className="mt-5">
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
        renderCard={(j) => {
          const accentColor = PRIORITY_ACCENT[j.priority] ?? "#D1D5DB";
          return (
            <>
              {/*
                Faixa de cor na base do card — mesma ideia do KanbanBoard de
                candidatos (score bar). rounded-b-xl garante que os cantos
                inferiores sigam o rounded-xl do KanbanCard sem precisar de
                overflow-hidden (que quebraria o ring de drag).
              */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-xl"
                style={{ backgroundColor: accentColor }}
              />

              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900 leading-snug">{j.title}</p>
                <PriorityBadge priority={j.priority} className="shrink-0" />
              </div>

              <p className="text-[11px] text-gray-500 mt-1">
                {j.isTalentPool
                  ? "Banco de Talentos"
                  : j.city
                  ? `${j.city}/${j.state}`
                  : "Múltiplas cidades"}{" "}
                · {MODALITY_LABELS[j.modality]}
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
          );
        }}
      />
    </div>
  );
}
