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
  initialParams?: Record<string, string | undefined>;
}

type View = "list" | "kanban";

function KanbanView({
  kanbanCards,
  columns,
  canManage,
  onViewChange,
}: {
  kanbanCards: KanbanAdmission[];
  columns: KanbanColumnDef[];
  canManage: boolean;
  onViewChange: (v: View) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ViewToggle view="kanban" onChange={onViewChange} />
      </div>
      <AdmissionKanbanBoard admissions={kanbanCards} columns={columns} canManage={canManage} />
    </div>
  );
}

export function AdmissionDashboardClient({
  rows,
  kanbanCards,
  columns,
  stages,
  companies,
  positions,
  canManage,
  initialParams = {},
}: Props) {
  const [view, setViewState] = useState<View>(initialParams.view === "kanban" ? "kanban" : "list");

  // A visualização também fica na URL (?view=kanban) para sobreviver ao F5 e ao "voltar".
  function setView(v: View) {
    setViewState(v);
    const url = new URL(window.location.href);
    if (v === "kanban") url.searchParams.set("view", "kanban");
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  }

  if (view === "list") {
    return (
      <AdmissionsExplorer
        rows={rows}
        stages={stages}
        companies={companies}
        positions={positions}
        view="list"
        onViewChange={setView}
        initialParams={initialParams}
        canManage={canManage}
      />
    );
  }

  return <KanbanView kanbanCards={kanbanCards} columns={columns} canManage={canManage} onViewChange={setView} />;
}
