"use client";

import type { ReactNode } from "react";
import { useState } from "react";

interface Props {
  checklist: ReactNode;
  attachments: ReactNode;
  pendingDocsCount: number;
}

export function AdmissionDetailTabs({ checklist, attachments, pendingDocsCount }: Props) {
  const [tab, setTab] = useState<"checklist" | "docs">("checklist");

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="bg-[#EEF4E3] rounded-[10px] p-1 flex gap-0.5 w-fit">
        <button
          type="button"
          onClick={() => setTab("checklist")}
          className={`px-4 py-2 rounded-lg text-[13.5px] font-bold transition-colors ${
            tab === "checklist"
              ? "bg-[#90CB46] text-[#0C0D0C]"
              : "text-[#3E4A34] hover:text-[#1A2213]"
          }`}
        >
          Checklist
        </button>
        <button
          type="button"
          onClick={() => setTab("docs")}
          className={`px-4 py-2 rounded-lg text-[13.5px] font-bold transition-colors flex items-center gap-1.5 ${
            tab === "docs"
              ? "bg-[#90CB46] text-[#0C0D0C]"
              : "text-[#3E4A34] hover:text-[#1A2213]"
          }`}
        >
          Documentos
          {pendingDocsCount > 0 && (
            <span className="bg-[#F3B23A] text-[#4A2E00] text-[11px] font-extrabold px-2 py-0.5 rounded-full">
              {pendingDocsCount} pendente{pendingDocsCount === 1 ? "" : "s"}
            </span>
          )}
        </button>
      </div>

      <div className="min-w-0">
        {tab === "checklist" ? checklist : attachments}
      </div>
    </div>
  );
}
