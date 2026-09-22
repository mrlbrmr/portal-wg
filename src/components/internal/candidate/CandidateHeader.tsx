"use client";

import type { Ref } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  SquareArrowOutUpRight,
  UserX,
  X,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CandidateAvatar } from "@/components/internal/candidates/CandidateAvatar";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import type { CandidateStageFlow, FlowStage } from "@/lib/recruitment/candidate-stage-flow";
import { MATCH_SCORE_HINT, formatAppliedAgo } from "@/lib/recruitment/candidate-presentation";
import { CandidateNavigation, type CandidateQueueNav } from "./CandidateNavigation";
import { ContactMenu } from "./ContactMenu";
import { candidateLocation, formatDateAtTime, type CandidateDetail } from "./types";

export type StageActionKind = "advance" | "back" | "resume" | "move" | "reject";

interface Props {
  data: CandidateDetail | null;
  jobTitle?: string;
  /** Aderência (0–100) da análise de IA mais recente; undefined = sem análise. */
  score: number | undefined;
  /** Está na primeira etapa do funil (candidatura nova, ainda sem triagem). */
  isNew: boolean;
  flow: CandidateStageFlow | null;
  canManage: boolean;
  /** Ação de etapa em andamento — trava as ações de etapa. */
  pending: StageActionKind | null;
  titleId: string;
  closeRef: Ref<HTMLButtonElement>;
  nav: CandidateQueueNav;
  onClose: () => void;
  onChangeStage: (stage: FlowStage, kind: StageActionKind) => void;
  onOpenMove: () => void;
  onOpenReject: () => void;
  onEdit: () => void;
  onCopy: (label: "E-mail" | "Telefone", value: string) => void;
}

const linkAction =
  "inline-flex items-center gap-1 rounded-control text-meta font-medium text-wg-ink-muted underline-offset-2 transition-colors hover:text-wg-green-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50";

/**
 * Cabeçalho do Quick View: quem é (nome, vaga, local), sinais de decisão (aderência,
 * novo, origem), contexto discreto (quando se candidatou, responsável) e as ações do
 * painel (navegar, contatar, mais ações, fechar). A etapa e as decisões ficam na barra
 * fixa do rodapé — um só bloco "grudado" de cada lado.
 */
export function CandidateHeader({
  data,
  jobTitle,
  score,
  isNew,
  flow,
  canManage,
  pending,
  titleId,
  closeRef,
  nav,
  onClose,
  onChangeStage,
  onOpenMove,
  onOpenReject,
  onEdit,
  onCopy,
}: Props) {
  const location = data ? candidateLocation(data) : null;
  const busy = pending !== null;

  const moreItems: DropdownMenuItem[] = [];
  if (canManage && flow) {
    if (flow.previous) {
      const prev = flow.previous;
      moreItems.push({ label: `Voltar para ${prev.name}`, icon: ArrowLeft, onSelect: () => onChangeStage(prev, "back") });
    }
    if (flow.moveTargets.length > 0) {
      moreItems.push({ label: "Mover para outra etapa…", icon: ArrowRightLeft, onSelect: onOpenMove });
    }
    moreItems.push({ label: "Editar dados", icon: Pencil, onSelect: onEdit });
    if (flow.lost) {
      moreItems.push({ type: "separator" });
      moreItems.push({ label: "Reprovar candidatura…", icon: UserX, danger: true, onSelect: onOpenReject });
    }
  }

  const source = data ? APPLICATION_SOURCE_LABELS[data.source] ?? data.source : null;

  return (
    <header className="shrink-0 border-b border-wg-border-lighter px-4 pb-3 pt-3 sm:px-5">
      <div className="flex items-start gap-3">
        {data ? (
          <CandidateAvatar name={data.fullName} seed={data.id} size="lg" className="mt-0.5" />
        ) : (
          <Skeleton className="mt-0.5 h-10 w-10 shrink-0 rounded-full" />
        )}

        <div className="min-w-0 flex-1">
          {data ? (
            <h2
              id={titleId}
              tabIndex={-1}
              className="truncate font-sora text-[18px] font-semibold leading-tight text-wg-ink outline-none"
              title={data.fullName}
            >
              {data.fullName}
            </h2>
          ) : (
            <>
              <h2 id={titleId} tabIndex={-1} className="sr-only">
                Carregando candidato
              </h2>
              <Skeleton className="h-5 w-56" />
            </>
          )}
          {data ? (
            <p className="mt-0.5 truncate text-meta text-wg-ink-muted" title={[jobTitle, location].filter(Boolean).join(" · ")}>
              {jobTitle && <span className="font-medium text-wg-ink-secondary">{jobTitle}</span>}
              {jobTitle && location && <span aria-hidden> · </span>}
              {location && (
                <>
                  <MapPin className="mb-0.5 mr-0.5 inline h-3.5 w-3.5" aria-hidden />
                  {location}
                </>
              )}
            </p>
          ) : (
            <Skeleton className="mt-1.5 h-4 w-40" />
          )}
        </div>

        {/* Ações do painel */}
        <div className="flex shrink-0 items-center gap-1">
          <CandidateNavigation nav={nav} className="mr-1 hidden sm:flex" />
          {data && <ContactMenu email={data.email} phone={data.phone} onCopy={onCopy} />}
          {moreItems.length > 0 && (
            <DropdownMenu
              items={moreItems}
              ariaLabel="Mais ações"
              title="Mais ações"
              disabled={busy}
              triggerClassName={buttonVariants({ variant: "tertiary", size: "icon" })}
              trigger={busy ? <Loader2 className="animate-spin" aria-hidden /> : <MoreHorizontal aria-hidden />}
            />
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar candidato"
            title="Fechar (Esc)"
            className={buttonVariants({ variant: "tertiary", size: "icon" })}
          >
            <X aria-hidden />
          </button>
        </div>
      </div>

      {data && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 sm:pl-[52px]">
          <div className="flex flex-wrap items-center gap-1.5">
            {score !== undefined && (
              <StatusBadge tone={score >= 70 ? "success" : "neutral"} hint={MATCH_SCORE_HINT}>
                <span className="tabular-nums">{Math.round(score)}%</span> de aderência
              </StatusBadge>
            )}
            {flow?.status === "LOST" && <StatusBadge tone="danger" icon={UserX}>Reprovado</StatusBadge>}
            {flow?.status === "OFF_PIPELINE" && <StatusBadge tone="warning">Fora do Kanban</StatusBadge>}
            {isNew && flow?.status === "OPEN" && (
              <StatusBadge tone="info" hint="Na primeira etapa do funil, ainda sem triagem.">
                Novo
              </StatusBadge>
            )}
            {source && <StatusBadge tone="neutral">Via {source}</StatusBadge>}
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-meta text-wg-ink-muted">
            <span title={formatDateAtTime(data.createdAt)}>{formatAppliedAgo(data.createdAt)}</span>
            {data.jobResponsible && (
              <>
                <span aria-hidden>·</span>
                <span title="Recrutador(a) responsável pela vaga">
                  Responsável: <span className="text-wg-ink-secondary">{data.jobResponsible}</span>
                </span>
              </>
            )}
          </p>
          <CandidateNavigation nav={nav} className="-my-1 ml-auto sm:hidden" />
        </div>
      )}
    </header>
  );
}

/**
 * "Abrir perfil completo". A página dedicada do candidato ainda não existe: enquanto
 * `href` for null, a ação expande o painel (mesma ficha, largura total) em vez de navegar.
 * Quando a rota existir, basta passar o href — a ação vira um link para ela.
 */
export function FullProfileAction({
  href = null,
  expanded,
  onToggleExpand,
}: {
  href?: string | null;
  /** null = expansão indisponível (painel já ocupa a tela). */
  expanded: boolean | null;
  onToggleExpand: () => void;
}) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkAction}>
        Abrir perfil completo
        <SquareArrowOutUpRight className="h-3.5 w-3.5" aria-hidden />
      </a>
    );
  }
  if (expanded === null) return null;
  return (
    <button type="button" onClick={onToggleExpand} className={linkAction} aria-pressed={expanded}>
      {expanded ? "Voltar à visão rápida" : "Abrir perfil completo"}
      {expanded ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}
