"use client";

import type { Ref } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CalendarClock,
  Hourglass,
  Loader2,
  MapPin,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  UserRound,
  UserX,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { Skeleton } from "@/components/ui/Skeleton";
import { StageBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import type { CandidateStageFlow, FlowStage } from "@/lib/recruitment/candidate-stage-flow";
import { formatRelativeTime } from "@/lib/utils";
import { ContactMenu } from "./ContactMenu";
import { candidateLocation, formatDateAtTime, type CandidateDetail } from "./types";

export type StageActionKind = "advance" | "back" | "resume" | "move" | "reject";

interface Props {
  data: CandidateDetail | null;
  jobTitle?: string;
  flow: CandidateStageFlow | null;
  canManage: boolean;
  /** Ação de etapa em andamento — trava só os botões de etapa. */
  pending: StageActionKind | null;
  enteredStageAt: string | null;
  titleId: string;
  closeRef: Ref<HTMLButtonElement>;
  onClose: () => void;
  onChangeStage: (stage: FlowStage, kind: StageActionKind) => void;
  onOpenMove: () => void;
  onOpenReject: () => void;
  onEdit: () => void;
  onCopy: (label: "E-mail" | "Telefone", value: string) => void;
}

/** "3h", "2 dias", "menos de 1h" — há quanto tempo está na etapa. */
function durationSince(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "menos de 1h";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 dia" : `${d} dias`;
}

export function CandidateHeader({
  data,
  jobTitle,
  flow,
  canManage,
  pending,
  enteredStageAt,
  titleId,
  closeRef,
  onClose,
  onChangeStage,
  onOpenMove,
  onOpenReject,
  onEdit,
  onCopy,
}: Props) {
  const location = data ? candidateLocation(data) : null;
  const busy = pending !== null;
  const lastMove = data?.stageHistory[data.stageHistory.length - 1];

  // ── Ações de etapa válidas para o estado atual ──
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
      moreItems.push({ label: "Reprovar candidatura", icon: UserX, danger: true, onSelect: onOpenReject });
    }
  }

  const primary = (() => {
    if (!canManage || !flow) return null;
    if (flow.status === "OPEN" && flow.next) {
      const next = flow.next;
      return (
        <Button
          variant="primary"
          className="min-w-0 flex-1"
          disabled={busy}
          onClick={() => onChangeStage(next, "advance")}
          title={`Avançar para ${next.name}`}
          aria-busy={pending === "advance" || undefined}
        >
          {pending === "advance" && <Loader2 className="animate-spin" aria-hidden />}
          <span className="truncate">
            {pending === "advance" ? "Movendo…" : `Avançar para ${next.name}`}
          </span>
          {pending !== "advance" && <ArrowRight aria-hidden />}
        </Button>
      );
    }
    if ((flow.status === "LOST" || flow.status === "OFF_PIPELINE") && flow.resumeTo) {
      const to = flow.resumeTo;
      return (
        <Button
          variant={flow.status === "LOST" ? "secondary" : "primary"}
          className="min-w-0 flex-1"
          icon={RotateCcw}
          loading={pending === "resume"}
          disabled={busy}
          onClick={() => onChangeStage(to, "resume")}
          title={flow.status === "LOST" ? `Reabrir em ${to.name}` : `Retomar em ${to.name}`}
        >
          <span className="truncate">
            {flow.status === "LOST" ? `Reabrir em ${to.name}` : `Retomar em ${to.name}`}
          </span>
        </Button>
      );
    }
    return null;
  })();

  return (
    <header className="shrink-0 border-b border-wg-border-lighter px-5 pb-4 pt-4 sm:px-6">
      {/* Identidade */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {data ? (
            <h2 id={titleId} className="font-sora text-[19px] font-semibold leading-tight text-wg-ink">
              {data.fullName}
            </h2>
          ) : (
            <>
              <h2 id={titleId} className="sr-only">
                Carregando candidato
              </h2>
              <Skeleton className="h-6 w-56" />
            </>
          )}
          {data ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-meta text-wg-ink-muted">
              {jobTitle && <span className="font-medium text-wg-ink-secondary">{jobTitle}</span>}
              {jobTitle && location && <span aria-hidden>·</span>}
              {location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {location}
                </span>
              )}
            </p>
          ) : (
            <Skeleton className="mt-2 h-4 w-40" />
          )}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar ficha do candidato"
          title="Fechar (Esc)"
          className="-mr-1 rounded-control p-1.5 text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {data && (
        <>
          {/* Origem + metadados operacionais (só o que existe no banco) */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-meta text-wg-ink-muted">
            <StatusBadge tone="neutral">Via {APPLICATION_SOURCE_LABELS[data.source] ?? data.source}</StatusBadge>
            <span className="inline-flex items-center gap-1" title={formatDateAtTime(data.createdAt)}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              Candidatou-se {formatRelativeTime(data.createdAt)}
            </span>
            {enteredStageAt && data.stageHistory.length > 1 && (
              <span
                className="inline-flex items-center gap-1"
                title={lastMove ? `Movido por ${lastMove.changedBy} em ${formatDateAtTime(lastMove.changedAt)}` : undefined}
              >
                <Hourglass className="h-3.5 w-3.5" aria-hidden />
                Na etapa há {durationSince(enteredStageAt)}
              </span>
            )}
            {data.jobResponsible && (
              <span className="inline-flex items-center gap-1" title="Recrutador(a) responsável pela vaga">
                <UserRound className="h-3.5 w-3.5" aria-hidden />
                Responsável: <span className="text-wg-ink-secondary">{data.jobResponsible}</span>
              </span>
            )}
          </div>

          {/* Etapa atual + ações */}
          <div className="mt-4 rounded-card border border-wg-border-lighter bg-wg-bg/60 p-3">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="text-label uppercase tracking-wide text-wg-ink-muted">Etapa atual</span>
              <StageBadge color={data.stage?.color}>{data.stage?.name ?? "Sem etapa"}</StageBadge>
              {flow?.position && (
                <span className="text-meta tabular-nums text-wg-ink-muted">
                  {flow.position.index} de {flow.position.total}
                </span>
              )}
              {flow?.status === "LOST" && <StatusBadge tone="danger">Reprovada</StatusBadge>}
              {flow?.status === "OFF_PIPELINE" && <StatusBadge tone="warning">Fora do Kanban</StatusBadge>}
              {flow?.status === "FINAL" && <StatusBadge tone="success">Etapa final</StatusBadge>}
            </div>

            <div className="flex items-center gap-2">
              {primary ?? <div className="flex-1" />}
              <ContactMenu email={data.email} phone={data.phone} onCopy={onCopy} />
              {moreItems.length > 0 && (
                <DropdownMenu
                  items={moreItems}
                  ariaLabel="Mais ações"
                  title="Mais ações"
                  disabled={busy}
                  triggerClassName={buttonVariants({ variant: "secondary", size: "icon" })}
                  trigger={busy && pending !== "advance" && pending !== "resume" ? <Loader2 className="animate-spin" aria-hidden /> : <MoreHorizontal aria-hidden />}
                />
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
