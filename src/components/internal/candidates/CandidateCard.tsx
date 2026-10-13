"use client";

import { memo, type ElementType, type MouseEvent } from "react";
import {
  Check,
  ClipboardCheck,
  Clock,
  FileText,
  GripVertical,
  Loader2,
  MapPin,
  MoreHorizontal,
  NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
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
  /** Acabou de ser solto em outra etapa: realce breve que some sozinho. */
  landed?: boolean;
}

/** Cliques em controles internos não abrem a ficha. */
function fromInteractive(e: MouseEvent) {
  return !!(e.target as HTMLElement).closest("a, button, input, label, [role='menu']");
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/**
 * Card do candidato no Kanban, em três níveis:
 *   1º nome e a ação da etapa (Enviar teste, Registrar entrevista);
 *   2º cargo/experiência, cidade, aderência e sinais que pedem ação;
 *   3º tempo na etapa, candidatura, origem e atalhos (anotações, avaliações, currículo).
 * O card inteiro abre o Quick View no clique e arrasta com o ponteiro; para o teclado, o nome
 * é o botão de abrir e a alça à esquerda (visível no hover/foco) pega o card. Ações
 * secundárias ficam no menu "⋯".
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
  landed = false,
}: Props) {
  const location = formatCandidateLocation(c.city, c.state);
  const profile = [c.lastPosition, formatExperience(c.experienceYears)].filter(Boolean).join(" · ");
  const isOverlay = drag?.isOverlay ?? false;
  const isPlaceholder = drag?.isDragging ?? false;
  const showCheckbox = selected || selectionActive;
  const resumeHref = c.resumeName ? `/api/applications/${c.id}/resume` : null;
  // "Parado há N dias" (regra STAGE_IDLE_WARNING_DAYS) destaca a própria linha de tempo na
  // etapa, em vez de repetir o mesmo fato num badge.
  const idle = signals.find((s) => s.key === "idle");
  const badges = idle ? signals.filter((s) => s !== idle) : signals;
  const applied = `${formatAppliedAgo(c.createdAt)} · ${c.sourceLabel}`;

  // Atalhos discretos: anotações, avaliações registradas e currículo.
  const shortcuts = (c.hasNotes || c.assessmentCount > 0 || (resumeHref && !isOverlay)) && (
    <div className="-my-1 -mr-1 flex shrink-0 items-center">
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
  );

  return (
    <article
      aria-label={c.fullName}
      aria-current={active ? "true" : undefined}
      onClick={(e) => {
        if (!isOverlay && !fromInteractive(e)) onOpen(c.id);
      }}
      className={cn(
        "group/card relative rounded-card border bg-white p-3 text-left transition-[box-shadow,border-color,background-color] duration-300",
        drag?.handleProps ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        selected
          ? "border-wg-green-dark/70 shadow-[0_0_0_1px_rgba(79,105,48,.45)]"
          : active
          ? "border-wg-green-dark/40 bg-[#F8FBF3] shadow-[0_1px_3px_rgba(26,34,19,.08)]"
          : "border-wg-border-lighter shadow-[0_1px_2px_rgba(26,34,19,.04)] hover:border-[#CBDBB6] hover:shadow-[0_4px_12px_-4px_rgba(26,34,19,.14)]",
        landed && !selected && !active && "border-wg-green-dark/45 shadow-[0_0_0_3px_rgba(144,203,70,.22)]",
        // Lugar de origem enquanto o clone é arrastado: contorno tracejado, conteúdo esmaecido.
        isPlaceholder && "border-dashed border-[#BFD0AA] bg-wg-bg shadow-none [&>*]:opacity-40",
        isOverlay && "rotate-[1deg] cursor-grabbing border-[#CBDBB6] shadow-[0_12px_28px_-8px_rgba(26,34,19,.24)]"
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

      <header className="flex items-start gap-2.5 pr-7">
        {/* Avatar ↔ caixa de seleção para comparar */}
        <div className="relative h-8 w-8 shrink-0">
          <CandidateAvatar
            name={c.fullName}
            seed={c.id}
            size="sm"
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
          {profile && (
            <p className="truncate text-[12px] leading-[18px] text-wg-ink-secondary" title={profile}>
              {profile}
            </p>
          )}
          {location && (
            <p className="flex items-center gap-1 text-[12px] leading-[18px] text-wg-ink-muted" title={location}>
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{location}</span>
            </p>
          )}
        </div>
      </header>

      {/* Ações secundárias: só o menu. Abrir a ficha é o próprio card (ou o nome, no teclado). */}
      {!isOverlay && (
        <div className="absolute right-1.5 top-2" onPointerDown={stop} onClick={stop}>
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
        <span className="absolute right-1.5 top-2 flex h-7 w-7 items-center justify-center text-wg-ink-muted" aria-hidden>
          <MoreHorizontal className="h-4 w-4" />
        </span>
      )}

      {score !== undefined && <MatchScore score={score} className="mt-2.5" />}

      <CandidateSignalBadges signals={badges} className="mt-2" />

      {/* Terciário: tempo na etapa (operacional) com os atalhos ao lado; candidatura e origem. */}
      <div className="mt-2.5 text-[11.5px] leading-4 text-wg-ink-muted">
        <div className="flex min-h-4 items-center gap-2">
          {c.enteredStageAt ? (
            idle ? (
              <p className="flex min-w-0 flex-1 items-center gap-1 font-medium text-warning-fg" title={idle.hint}>
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{formatStageTime(c.enteredStageAt)}</span>
                <span className="sr-only">. {idle.label}.</span>
              </p>
            ) : (
              <p className="min-w-0 flex-1 truncate">{formatStageTime(c.enteredStageAt)}</p>
            )
          ) : (
            <span className="flex-1" />
          )}
          {shortcuts}
        </div>
        <p className="mt-px truncate" title={`${applied} (origem da candidatura)`}>
          {applied}
        </p>
      </div>

      {stageAction && !isOverlay && (
        <button
          type="button"
          onClick={stageAction.onClick}
          onPointerDown={stop}
          disabled={stageAction.busy}
          className="mt-2.5 inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-control border border-[#D3E2BF] bg-wg-sidebar/60 px-2 text-[12px] font-semibold text-wg-green-dark transition-colors hover:border-[#BCD1A2] hover:bg-wg-sidebar disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60"
        >
          {stageAction.busy ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <stageAction.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="truncate">{stageAction.label}</span>
        </button>
      )}
    </article>
  );
}

export const CandidateCard = memo(CandidateCardBase);

/** Placeholder com o mesmo formato do card real (carregamento). */
export function CandidateCardSkeleton() {
  return (
    <div className="rounded-card border border-wg-border-lighter bg-white p-3" aria-hidden>
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[#E9EEE2]" />
        <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#E9EEE2]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[#E9EEE2]" />
        </div>
      </div>
      <div className="mt-3 h-[5px] w-full animate-pulse rounded-full bg-[#E9EEE2]" />
      <div className="mt-3 space-y-1.5">
        <div className="h-3 w-2/3 animate-pulse rounded bg-[#E9EEE2]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[#E9EEE2]" />
      </div>
    </div>
  );
}
