"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, FileText, MoreHorizontal, NotebookPen } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { StageBadge } from "@/components/ui/StatusBadge";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import {
  formatCandidateLocation,
  formatDaysShort,
  relativeDay,
  type CandidateSignal,
} from "@/lib/recruitment/candidate-presentation";
import { CandidateAvatar } from "./CandidateAvatar";
import { MatchScore } from "./MatchScore";
import { CandidateSignalBadges } from "./CandidateSignalBadges";
import type { CandidateSortKey, PipelineCandidate, PipelineStage } from "./types";

export interface ListRow {
  candidate: PipelineCandidate;
  score: number | undefined;
  signals: CandidateSignal[];
  menuItems: DropdownMenuItem[];
}

interface Props {
  rows: ListRow[];
  stageById: Map<string, PipelineStage>;
  sort: CandidateSortKey;
  onSortChange: (s: CandidateSortKey) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (ids: string[], select: boolean) => void;
  onOpen: (id: string) => void;
  /** Candidato aberto no Quick View. */
  activeId?: string | null;
}

/** Cabeçalhos ordenáveis: cada coluna alterna entre as duas direções da sua ordenação. */
const SORTABLE: Record<string, [CandidateSortKey, CandidateSortKey]> = {
  name: ["nameAZ", "nameZA"],
  score: ["scoreDesc", "scoreAsc"],
  applied: ["recent", "oldest"],
  stage: ["stageLongest", "stageShortest"],
};

/**
 * Visão analítica: uma linha por candidato, colunas escaneáveis e ordenáveis. Mostra só
 * colunas com dado real (não há responsável por candidatura — o recrutador é da vaga).
 */
export function CandidateList({ rows, stageById, sort, onSortChange, selected, onToggleSelect, onToggleAll, onOpen, activeId = null }: Props) {
  const ids = rows.map((r) => r.candidate.id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = !allSelected && ids.some((id) => selected.has(id));

  const header = (key: keyof typeof SORTABLE, label: string, className?: string) => {
    const [first, second] = SORTABLE[key];
    const active = sort === first ? "first" : sort === second ? "second" : null;
    // O primeiro clique usa a direção mais útil: nome A→Z (asc); aderência, data e tempo
    // na etapa do maior para o menor (desc).
    const ascending = key === "name" ? active === "first" : active === "second";
    const ariaSort = active ? (ascending ? "ascending" : "descending") : "none";
    const Icon = !active ? ChevronsUpDown : ascending ? ArrowUp : ArrowDown;
    return (
      <th scope="col" aria-sort={ariaSort} className={cn("px-3 py-2.5 font-medium", className)}>
        <button
          type="button"
          onClick={() => onSortChange(active === "first" ? second : first)}
          className={cn(
            "-mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60",
            active && "text-wg-ink"
          )}
        >
          {label}
          <Icon className={cn("h-3 w-3", !active && "opacity-50")} aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-hidden rounded-card border border-wg-border-lighter bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className="border-b border-wg-border-lighter bg-[#FAFBF8] text-[12px] text-wg-ink-muted">
            <tr>
              <th scope="col" className="w-10 py-2.5 pl-4 pr-1">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() => onToggleAll(ids, !allSelected)}
                  aria-label={allSelected ? "Desmarcar todos" : "Selecionar todos para comparar"}
                  className="h-4 w-4 cursor-pointer accent-[#4F6930]"
                />
              </th>
              {header("name", "Candidato", "min-w-[240px]")}
              <th scope="col" className="px-3 py-2.5 font-medium">Etapa</th>
              {header("score", "Aderência")}
              {header("applied", "Candidatura")}
              {header("stage", "Na etapa")}
              <th scope="col" className="px-3 py-2.5 font-medium">Origem</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Sinais</th>
              <th scope="col" className="w-12 px-3 py-2.5">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <CandidateListRow
                key={r.candidate.id}
                row={r}
                stage={stageById.get(r.candidate.stageId)}
                selected={selected.has(r.candidate.id)}
                active={r.candidate.id === activeId}
                onToggleSelect={onToggleSelect}
                onOpen={onOpen}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CandidateListRow({
  row: { candidate: c, score, signals, menuItems },
  stage,
  selected,
  active,
  onToggleSelect,
  onOpen,
}: {
  row: ListRow;
  stage: PipelineStage | undefined;
  selected: boolean;
  active: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const location = formatCandidateLocation(c.city, c.state);
  const secondary = [c.lastPosition, location].filter(Boolean).join(" · ");

  return (
    <tr
      aria-current={active ? "true" : undefined}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a, button, input, [role='menu']")) onOpen(c.id);
      }}
      className={cn(
        "cursor-pointer border-b border-wg-border-lighter text-[13px] transition-colors last:border-b-0",
        selected ? "bg-[#F4F8EC]" : active ? "bg-[#F8FBF3]" : "hover:bg-[#FAFBF7]",
        active && "shadow-[inset_3px_0_0_#4F6930]"
      )}
    >
      <td className="py-2.5 pl-4 pr-1 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(c.id)}
          aria-label={`Selecionar ${c.fullName} para comparar`}
          className="h-4 w-4 cursor-pointer accent-[#4F6930]"
        />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <CandidateAvatar name={c.fullName} seed={c.id} size="sm" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              className="block max-w-[260px] truncate rounded text-left font-semibold text-wg-ink hover:text-wg-green-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60"
            >
              {c.fullName}
            </button>
            {secondary && (
              <p className="max-w-[260px] truncate text-[12px] text-wg-ink-muted" title={secondary}>
                {secondary}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">{stage ? <StageBadge color={stage.color}>{stage.name}</StageBadge> : <Muted>—</Muted>}</td>
      <td className="px-3 py-2.5">
        {score !== undefined ? <MatchScore score={score} variant="inline" /> : <Muted title="Aderência ainda não calculada">—</Muted>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-wg-ink-secondary" title={new Date(c.createdAt).toLocaleDateString("pt-BR")}>
        {capitalize(relativeDay(c.createdAt))}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-wg-ink-secondary">
        {c.enteredStageAt ? capitalize(formatDaysShort(c.enteredStageAt)) : <Muted title="Sem registro de entrada na etapa">—</Muted>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-wg-ink-secondary">{APPLICATION_SOURCE_LABELS[c.source] ?? c.source}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <CandidateSignalBadges signals={signals} max={1} />
          {c.hasNotes && <NotebookPen className="h-3.5 w-3.5 shrink-0 text-wg-ink-muted" aria-label="Possui anotações" />}
          {c.resumeName && (
            <a
              href={`/api/applications/${c.id}/resume`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir currículo de ${c.fullName}`}
              title="Abrir currículo"
              className="rounded p-0.5 text-wg-ink-muted hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu
          portal
          ariaLabel={`Ações de ${c.fullName}`}
          title="Mais ações"
          items={menuItems}
          trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
          triggerClassName="ml-auto flex h-7 w-7 items-center justify-center rounded-control text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60 aria-expanded:bg-wg-hover-light"
        />
      </td>
    </tr>
  );
}

function Muted({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="text-wg-ink-muted/70" title={title}>
      {children}
    </span>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
