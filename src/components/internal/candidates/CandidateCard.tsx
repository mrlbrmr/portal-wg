"use client";

import { memo, type ElementType, type MouseEvent } from "react";
import {
  CalendarDays,
  Check,
  ClipboardCheck,
  FileText,
  GripVertical,
  Loader2,
  MapPin,
  MoreHorizontal,
  NotebookPen,
  PanelRightOpen,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import {
  formatAppliedAgo,
  formatCandidateLocation,
  formatExperience,
  formatStageTime,
  type CandidateSignal,
} from "@/lib/recruitment/candidate-presentation";
import type { DragHandleProps } from "@/components/internal/kanban-dnd";
import { CandidateAvatar } from "./CandidateAvatar";
import { MatchScore } from "./MatchScore";
import { CandidateSignalBadges } from "./CandidateSignalBadges";
import type { PipelineCandidate } from "./types";

/** Próxima ação da etapa (Enviar teste, Registrar entrevista) — botão compacto no rodapé. */
export interface StageAction {
  label: string;
  icon: ElementType;
  busy?: boolean;
  onClick: () => void;
}

interface Props {
  candidate: PipelineCandidate;
  score: number | undefined;
  signals: CandidateSignal[];
  selected: boolean;
  /** Candidato aberto no Quick View ao lado. */
  active?: boolean;
  /** Há alguma seleção ativa: as caixas de seleção ficam visíveis em todos os cards. */
  selectionActive: boolean;
  menuItems: DropdownMenuItem[];
  stageAction?: StageAction | null;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  drag?: { isDragging: boolean; isOverlay: boolean; handleProps: DragHandleProps | null };
}

/** Cliques em controles internos não abrem a ficha. */
function fromInteractive(e: MouseEvent) {
  return !!(e.target as HTMLElement).closest("a, button, input, label, [role='menu']");
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/**
 * Card do candidato no Kanban: quem é (avatar, nome, cargo, cidade), aderência como
 * indicador auxiliar, tempo no processo, sinais que pedem ação e atalhos. O card inteiro
 * arrasta (ponteiro); a alça à esquerda aparece no hover/foco e serve ao teclado.
 */
function CandidateCardBase({
  candidate: c,
  score,
  signals,
  selected,
  active = false,
  selectionActive,
  menuItems,
  stageAction,
  onOpen,
  onToggleSelect,
  drag,
}: Props) {
  const location = formatCandidateLocation(c.city, c.state);
  const experience = formatExperience(c.experienceYears);
  const source = APPLICATION_SOURCE_LABELS[c.source] ?? c.source;
  const isOverlay = drag?.isOverlay ?? false;
  const showCheckbox = selected || selectionActive;
  const resumeHref = c.resumeName ? `/api/applications/${c.id}/resume` : null;

  return (
    <article
      aria-label={c.fullName}
      aria-current={active ? "true" : undefined}
      onClick={(e) => {
        if (!isOverlay && !fromInteractive(e)) onOpen(c.id);
      }}
      className={cn(
        "group/card relative rounded-card border bg-white p-3.5 text-left transition-[box-shadow,border-color,transform,opacity] duration-150",
        drag?.handleProps ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        selected
          ? "border-wg-green-dark/70 shadow-[0_0_0_1px_rgba(79,105,48,.45)]"
          : active
          ? "border-wg-green-dark/40 bg-[#F8FBF3] shadow-[0_1px_3px_rgba(26,34,19,.08)]"
          : "border-wg-border-lighter shadow-[0_1px_2px_rgba(26,34,19,.04)] hover:-translate-y-px hover:border-[#CBDBB6] hover:shadow-[0_6px_16px_-4px_rgba(26,34,19,.12)]",
        drag?.isDragging && "opacity-40",
        isOverlay && "rotate-[1.5deg] cursor-grabbing border-[#CBDBB6] shadow-[0_16px_32px_-8px_rgba(26,34,19,.25)]"
      )}
    >
      {/* Aberto no Quick View: faixa lateral verde (além do fundo, para não depender só de cor). */}
      {active && !isOverlay && (
        <span aria-hidden className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-wg-green-dark" />
      )}

      {/* Alça de teclado (Espaço pega, setas movem, Espaço solta). */}
      {drag?.handleProps && (
        <button
          type="button"
          {...drag.handleProps}
          aria-label={`Mover ${c.fullName} (Espaço para pegar, setas para mover)`}
          title="Arraste para mover"
          className="absolute left-0 top-1/2 flex h-8 w-3.5 -translate-y-1/2 items-center justify-center rounded-r text-wg-ink-muted/60 opacity-0 transition-opacity hover:text-wg-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60 group-hover/card:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}

      <header className="flex items-start gap-2.5 pr-6">
        {/* Avatar ↔ caixa de seleção para comparar */}
        <div className="relative h-9 w-9 shrink-0">
          <CandidateAvatar
            name={c.fullName}
            seed={c.id}
            className={cn(
              "transition-opacity",
              showCheckbox ? "opacity-0" : "group-hover/card:opacity-0 group-focus-within/card:opacity-0"
            )}
          />
          <label
            onPointerDown={stop}
            title={selected ? "Remover da comparação" : "Selecionar para comparar"}
            className={cn(
              "absolute inset-0 flex cursor-pointer items-center justify-center rounded-full border transition-opacity has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-wg-green/60",
              selected
                ? "border-wg-green-dark bg-wg-green-dark text-white"
                : "border-wg-border-light bg-white text-transparent hover:border-wg-green-dark/60",
              showCheckbox ? "opacity-100" : "opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100",
              isOverlay && "hidden"
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={selected}
              onChange={() => onToggleSelect(c.id)}
              aria-label={`Selecionar ${c.fullName} para comparar`}
            />
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </label>
        </div>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            onPointerDown={stop}
            className="line-clamp-2 max-w-full break-words rounded text-left text-[13.5px] font-semibold leading-5 text-wg-ink transition-colors hover:text-wg-green-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60"
            title={c.fullName}
            aria-label={`Abrir candidato ${c.fullName}`}
          >
            {c.fullName}
          </button>
          {c.lastPosition && (
            <p className="truncate text-[12px] leading-[18px] text-wg-ink-secondary" title={c.lastPosition}>
              {c.lastPosition}
            </p>
          )}
          {location && (
            <p className="flex items-center gap-1 truncate text-[12px] leading-[18px] text-wg-ink-muted">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{location}</span>
            </p>
          )}
        </div>
      </header>

      {/* Ações rápidas: menu sempre acessível; "abrir ficha" aparece no hover/foco. */}
      {!isOverlay && (
        <div
          className="absolute right-2 top-2.5 flex items-center gap-0.5"
          onPointerDown={stop}
          onClick={stop}
        >
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            aria-label={`Abrir ${c.fullName} no painel`}
            title="Abrir no painel"
            className="flex h-7 w-7 items-center justify-center rounded-control bg-white text-wg-ink-muted opacity-0 transition hover:bg-wg-hover-light hover:text-wg-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60 group-hover/card:opacity-100"
          >
            <PanelRightOpen className="h-3.5 w-3.5" aria-hidden />
          </button>
          <DropdownMenu
            portal
            ariaLabel={`Ações de ${c.fullName}`}
            title="Mais ações"
            items={menuItems}
            trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
            triggerClassName="flex h-7 w-7 items-center justify-center rounded-control text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60 aria-expanded:bg-wg-hover-light aria-expanded:text-wg-ink"
          />
        </div>
      )}
      {isOverlay && (
        <span className="absolute right-2 top-2.5 flex h-7 w-7 items-center justify-center text-wg-ink-muted" aria-hidden>
          <MoreHorizontal className="h-4 w-4" />
        </span>
      )}

      {score !== undefined && <MatchScore score={score} className="mt-3" />}

      <div className="mt-3 space-y-0.5 text-[12px] leading-[18px] text-wg-ink-muted">
        <p className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{formatAppliedAgo(c.createdAt)}</span>
        </p>
        {c.enteredStageAt && (
          <p className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{formatStageTime(c.enteredStageAt)}</span>
          </p>
        )}
      </div>

      <CandidateSignalBadges signals={signals} className="mt-2.5" />

      <footer className="mt-3 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-neutral-bg px-1.5 text-[11px] font-medium text-neutral-fg" title="Origem da candidatura">
            {source}
          </span>
          {experience && (
            <span className="inline-flex h-5 min-w-0 items-center truncate rounded-md bg-neutral-bg px-1.5 text-[11px] font-medium text-neutral-fg" title="Experiência informada no currículo">
              {experience}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 text-wg-ink-muted">
          {c.hasNotes && (
            <span className="flex h-6 w-6 items-center justify-center" title="Possui anotações do RH">
              <NotebookPen className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Possui anotações</span>
            </span>
          )}
          {c.assessmentCount > 0 && (
            <span
              className="flex h-6 items-center gap-0.5 px-1 text-[11px] font-medium tabular-nums"
              title={`${c.assessmentCount} ${c.assessmentCount === 1 ? "avaliação registrada" : "avaliações registradas"}`}
            >
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
              {c.assessmentCount}
              <span className="sr-only"> avaliações</span>
            </span>
          )}
          {resumeHref && !isOverlay && (
            <a
              href={resumeHref}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={stop}
              aria-label={`Abrir currículo de ${c.fullName}`}
              title="Abrir currículo"
              className="flex h-6 w-6 items-center justify-center rounded-control transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      </footer>

      {stageAction && !isOverlay && (
        <button
          type="button"
          onClick={stageAction.onClick}
          onPointerDown={stop}
          disabled={stageAction.busy}
          className="mt-2.5 inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-control border border-wg-border-light bg-white text-[12px] font-semibold text-wg-green-dark transition-colors hover:border-[#C9D9B4] hover:bg-wg-bg disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60"
        >
          {stageAction.busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <stageAction.icon className="h-3.5 w-3.5" aria-hidden />
          )}
          {stageAction.label}
        </button>
      )}
    </article>
  );
}

export const CandidateCard = memo(CandidateCardBase);

/** Placeholder com o mesmo formato do card real (carregamento). */
export function CandidateCardSkeleton() {
  return (
    <div className="rounded-card border border-wg-border-lighter bg-white p-3.5" aria-hidden>
      <div className="flex items-start gap-2.5">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[#E9EEE2]" />
        <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#E9EEE2]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[#E9EEE2]" />
        </div>
      </div>
      <div className="mt-3.5 h-1 w-full animate-pulse rounded-full bg-[#E9EEE2]" />
      <div className="mt-3 space-y-1.5">
        <div className="h-3 w-2/3 animate-pulse rounded bg-[#E9EEE2]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[#E9EEE2]" />
      </div>
      <div className="mt-3 h-5 w-16 animate-pulse rounded-md bg-[#E9EEE2]" />
    </div>
  );
}
