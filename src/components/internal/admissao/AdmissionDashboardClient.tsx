"use client";

import { useState } from "react";
import {
  AdmissionsExplorer,
  type AdmissionRow,
} from "@/components/internal/admissao/AdmissionsExplorer";
import {
  AdmissionKanbanBoard,
  type KanbanAdmission,
} from "@/components/internal/admissao/AdmissionKanbanBoard";
import type { KanbanColumnDef } from "@/components/internal/KanbanBoardShell";
import { ViewToggle } from "@/components/internal/ViewToggle";

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
        <ViewToggle view={view} onChange={setView} />
      </div>
      <AdmissionKanbanBoard
        admissions={kanbanCards}
        columns={columns}
        canManage={canManage}
      />
    </div>
  );
}
