"use client";

import type { ReactNode } from "react";
import { useState } from "react";

interface Props {
  attachments: ReactNode;
  pendingDocsCount: number;
  formViewer?: ReactNode;
}

export function AdmissionDetailTabs({ attachments, pendingDocsCount, formViewer }: Props) {
  const [tab, setTab] = useState<"docs" | "form">("docs");

  const btnClass = (active: boolean) =>
    `px-4 py-2 rounded-[8px] text-[13.5px] font-bold transition-colors ${
      active ? "bg-[#90CB46] text-[#0C0D0C]" : "text-[#3E4A34] hover:text-[#1A2213]"
    }`;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="bg-[#EEF4E3] rounded-[10px] p-1 flex gap-0.5 w-fit">
        <button
          type="button"
          onClick={() => setTab("docs")}
          className={`${btnClass(tab === "docs")} flex items-center gap-1.5`}
        >
          Documentos
          {pendingDocsCount > 0 && (
            <span className="bg-[#F3B23A] text-[#4A2E00] text-[11px] font-extrabold px-2 py-0.5 rounded-full">
              {pendingDocsCount} pendente{pendingDocsCount === 1 ? "" : "s"}
            </span>
          )}
        </button>
        {formViewer && (
          <button type="button" onClick={() => setTab("form")} className={btnClass(tab === "form")}>
            Formulário
          </button>
        )}
      </div>

      <div key={tab} className="tab-content min-w-0">
        {tab === "docs" && attachments}
        {tab === "form" && formViewer}
      </div>
    </div>
  );
}
