"use client";

import Link from "next/link";
import { Briefcase, Building2, UserCircle, CalendarClock } from "lucide-react";
import {
  KanbanBoardShell,
  type KanbanColumnDef,
} from "@/components/internal/KanbanBoardShell";

// Coluna sintética para admissões ainda sem etapa definida.
export const NO_STAGE = "__none__";

export interface KanbanAdmission {
  id: string;
  fullName: string;
  stageKey: string; // stageId ou NO_STAGE
  positionName: string | null;
  companyName: string | null;
  branchName: string | null;
  responsibleName: string | null;
  startDate: string | null;
}

interface Props {
  admissions: KanbanAdmission[];
  columns: KanbanColumnDef[];
  canManage: boolean;
}

export function AdmissionKanbanBoard({ admissions, columns, canManage }: Props) {
  return (
    <KanbanBoardShell<KanbanAdmission>
      initialItems={admissions}
      columns={columns}
      canManage={canManage}
      cardClassName="group"
      getId={(a) => a.id}
      getColumn={(a) => a.stageKey}
      applyColumn={(a, stageKey) => ({ ...a, stageKey })}
      onMove={(id, stageKey) =>
        fetch(`/api/admissoes/${id}/stage`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId: stageKey === NO_STAGE ? null : stageKey }),
        })
      }
      moveSuccess={(a, label) => `${a.fullName} movido para ${label}.`}
      moveError="Erro ao mover admissão."
      emptyLabel="Nenhuma admissão"
      renderCard={(a) => (
        <div className="min-w-0">
          <Link
            href={`/admissoes/${a.id}`}
            className="block max-w-full truncate text-left text-sm font-medium text-gray-900 transition-colors hover:text-wg-green-dark"
            title="Abrir admissão"
          >
            {a.fullName}
          </Link>

          <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500">
            {a.positionName && (
              <span className="flex items-center gap-1.5 truncate">
                <Briefcase className="w-3 h-3 shrink-0" />
                <span className="truncate">{a.positionName}</span>
              </span>
            )}
            {a.companyName && (
              <span className="flex items-center gap-1.5 truncate">
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {a.companyName}
                  {a.branchName ? ` · ${a.branchName}` : ""}
                </span>
              </span>
            )}
            {a.responsibleName && (
              <span className="flex items-center gap-1.5 truncate">
                <UserCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{a.responsibleName}</span>
              </span>
            )}
            {a.startDate && (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="w-3 h-3 shrink-0" />
                {a.startDate}
              </span>
            )}
          </div>
        </div>
      )}
    />
  );
}
