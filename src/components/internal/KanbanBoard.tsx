"use client";

import { useState } from "react";
import { Download, Mail, Phone, Trash2 } from "lucide-react";
import { formatDate, normalizeText } from "@/lib/utils";
import {
  KanbanBoardShell,
  type KanbanColumnDef,
} from "@/components/internal/KanbanBoardShell";
import { CandidateDrawer } from "@/components/internal/CandidateDrawer";

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

const STAGES: KanbanColumnDef[] = [
  { key: "NEW", label: "Novo", dot: "bg-blue-400" },
  { key: "SCREENING", label: "Triagem", dot: "bg-amber-400" },
  { key: "INTERVIEW", label: "Entrevista", dot: "bg-purple-400" },
  { key: "OFFER", label: "Proposta", dot: "bg-cyan-400" },
  { key: "HIRED", label: "Contratado", dot: "bg-wg-green" },
  { key: "REJECTED", label: "Reprovado", dot: "bg-red-400" },
];

export function KanbanBoard({ applications, canManage }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <>
    <KanbanBoardShell<KanbanApplication>
      initialItems={applications}
      columns={STAGES}
      canManage={canManage}
      cardClassName="group"
      filterFn={(a, q) => {
        const norm = normalizeText(q);
        return (
          normalizeText(a.fullName).includes(norm) ||
          normalizeText(a.email).includes(norm)
        );
      }}
      searchPlaceholder="Pesquisar candidato..."
      getId={(a) => a.id}
      getColumn={(a) => a.stage}
      applyColumn={(a, stage) => ({ ...a, stage })}
      onMove={(id, stage) =>
        fetch(`/api/applications/${id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage }),
        })
      }
      moveSuccess={(a, label) => `${a.fullName} movido para ${label}.`}
      moveError="Erro ao mover candidatura."
      emptyLabel="Nenhuma candidatura"
      onDelete={(id) =>
        fetch(`/api/applications/${id}`, {
          method: "DELETE",
          credentials: "same-origin",
        })
      }
      deleteSuccess={(a) => `Candidatura de ${a.fullName} excluída.`}
      deleteError="Erro ao excluir candidatura."
      confirmDelete={(a) => ({
        title: "Excluir candidatura?",
        message: `A candidatura de "${a.fullName}" e o currículo serão removidos permanentemente (LGPD). Esta ação não pode ser desfeita.`,
        confirmLabel: "Sim, excluir",
      })}
      renderCard={(a, api) => (
        <>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setDetailId(a.id)}
              className="block max-w-full truncate text-left text-sm font-medium text-gray-900 transition-colors hover:text-wg-green-dark"
              title="Abrir ficha do candidato"
            >
              {a.fullName}
            </button>
            <p className="text-[11px] text-gray-500 mt-0.5">{formatDate(a.createdAt)}</p>
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
                onClick={() => api.requestDelete(a.id)}
                title="Excluir candidatura"
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </>
      )}
    />

    <CandidateDrawer
      applicationId={detailId}
      canManage={canManage}
      onClose={() => setDetailId(null)}
    />
    </>
  );
}
