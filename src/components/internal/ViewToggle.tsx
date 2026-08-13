"use client";

import { List, LayoutGrid } from "lucide-react";

export type BoardView = "list" | "kanban";

interface Props {
  view: BoardView;
  onChange: (view: BoardView) => void;
  className?: string;
}

/** Alternador Lista/Kanban em cápsula bicolor — usado em Admissões, Vagas e Candidatos. */
export function ViewToggle({ view, onChange, className = "" }: Props) {
  return (
    <div
      className={`inline-flex rounded-full overflow-hidden border border-[#DCE8CC] shrink-0 ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={view === "list"}
        title="Visualização em lista"
        className={`flex items-center justify-center w-9 h-8 transition-colors ${
          view === "list"
            ? "bg-wg-green text-[#2E5018]"
            : "bg-white text-gray-400 hover:text-wg-green-dark hover:bg-[#F4F8EE]"
        }`}
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("kanban")}
        aria-pressed={view === "kanban"}
        title="Visualização em Kanban"
        className={`flex items-center justify-center w-9 h-8 transition-colors ${
          view === "kanban"
            ? "bg-wg-green text-[#2E5018]"
            : "bg-white text-gray-400 hover:text-wg-green-dark hover:bg-[#F4F8EE]"
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  );
}
