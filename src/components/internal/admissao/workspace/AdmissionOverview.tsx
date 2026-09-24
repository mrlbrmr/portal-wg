"use client";

import type { ReactNode } from "react";
import { Panel, panelLinkClass } from "@/components/ui/Panel";
import { useAdmissionWorkspace } from "./context";
import { AdmissionProgress } from "./AdmissionProgress";
import { AdmissionInternalNotes } from "./AdmissionInternalNotes";

/** Aba padrão: onde a admissão está, o que o RH anotou e o que aconteceu por último. */
export function AdmissionOverview({ recentActivity }: { recentActivity: ReactNode }) {
  const { data, setTab } = useAdmissionWorkspace();
  return (
    <div className="flex flex-col gap-5">
      <AdmissionProgress />
      <AdmissionInternalNotes />
      <Panel
        title="Atividade recente"
        action={
          data.historyCount > 4 ? (
            <button type="button" onClick={() => setTab("historico")} className={panelLinkClass}>
              Ver histórico completo
            </button>
          ) : null
        }
      >
        {recentActivity}
      </Panel>
    </div>
  );
}
