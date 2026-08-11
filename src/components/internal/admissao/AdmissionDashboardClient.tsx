"use client";

import { useState } from "react";
import { List, Kanban } from "lucide-react";
import {
  AdmissionsExplorer,
  type AdmissionRow,
} from "@/components/internal/admissao/AdmissionsExplorer";
import {
  AdmissionKanbanBoard,
  type KanbanAdmission,
} from "@/components/internal/admissao/AdmissionKanbanBoard";
import type { KanbanColumnDef } from "@/components/internal/KanbanBoardShell";

interface Option {
  id: string;
  name: string;
}

interface Props {
  rows: AdmissionRow[];
  kanbanCards: KanbanAdmission[];
  columns: KanbanColumnDef[];
  stages: Option[];
  companies: Option[];
  positions: Option[];
  canManage: boolean;
}

type View = "list" | "kanban";

export function AdmissionDashboardClient({
  rows,
  kanbanCards,
  columns,
  stages,
  companies,
  positions,
  canManage,
}: Props) {
  const [view, setView] = useState<View>("list");

  if (view === "list") {
    return (
      <AdmissionsExplorer
        rows={rows}
        stages={stages}
        companies={companies}
        positions={positions}
        view="list"
        onViewChange={setView}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <div className="bg-[#EEF4E3] rounded-[10px] p-1 flex gap-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-bold text-[#55614A] hover:text-[#1A2213] transition-colors"
          >
            <List className="w-3.5 h-3.5" /> Lista
          </button>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-bold bg-white text-[#1A2213] shadow-sm">
            <Kanban className="w-3.5 h-3.5" /> Kanban
          </span>
        </div>
      </div>
      <AdmissionKanbanBoard
        admissions={kanbanCards}
        columns={columns}
        canManage={canManage}
      />
    </div>
  );
}
