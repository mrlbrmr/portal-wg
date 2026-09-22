"use client";

import { ArrowRight, ChevronsRight, Loader2, RotateCcw, UserX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CandidateStageFlow, FlowStage } from "@/lib/recruitment/candidate-stage-flow";
import type { StageActionKind } from "./CandidateHeader";
import { formatRelativeDayTime, type CandidateDetail } from "./types";

interface Props {
  data: CandidateDetail | null;
  flow: CandidateStageFlow | null;
  canManage: boolean;
  pending: StageActionKind | null;
  enteredStageAt: string | null;
  /** Próximo candidato da fila — "Manter" deixa este na etapa e abre o próximo. */
  onKeep: (() => void) | null;
  onChangeStage: (stage: FlowStage, kind: StageActionKind) => void;
  onOpenReject: () => void;
}

/**
 * Barra de decisão fixa no rodapé do Quick View: onde o candidato está (etapa, próxima
 * etapa, desde quando) + as três decisões de triagem — Reprovar, Manter, Avançar. Fica
 * sempre visível enquanto o recrutador rola o perfil. As ações vêm de
 * candidate-stage-flow: só aparece o que o servidor aceita.
 */
export function CandidateStageBar({ data, flow, canManage, pending, enteredStageAt, onKeep, onChangeStage, onOpenReject }: Props) {
  if (!data || !flow) {
    return (
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-wg-border-lighter bg-white px-4 py-3 sm:px-5">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-48" />
      </div>
    );
  }

  const busy = pending !== null;
  const stageName = data.stage?.name ?? "Sem etapa";
  const stageColor = data.stage?.color ?? "#9AA68A";

  const statusLine =
    flow.status === "LOST"
      ? "Candidatura reprovada"
      : flow.status === "OFF_PIPELINE"
      ? "Fora do funil ativo"
      : flow.status === "FINAL"
      ? "Etapa final do processo"
      : flow.next
      ? `Próxima: ${flow.next.name}`
      : null;

  return (
    <section
      aria-label="Etapa e decisão"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-wg-border-lighter bg-white px-4 py-3 shadow-[0_-6px_16px_-12px_rgba(26,34,19,.18)] sm:px-5"
    >
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-[11px] font-medium uppercase tracking-wide text-wg-ink-muted">
          Etapa do processo
          {flow.position && (
            <span className="ml-1.5 normal-case tracking-normal tabular-nums">
              · {flow.position.index} de {flow.position.total}
            </span>
          )}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-body font-medium text-wg-ink">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: stageColor }} />
          <span className="truncate" title={stageName}>{stageName}</span>
        </p>
        {(statusLine || enteredStageAt) && (
          <p className="truncate text-[12px] text-wg-ink-muted">
            {statusLine}
            {statusLine && enteredStageAt && " · "}
            {enteredStageAt && `Entrou ${formatRelativeDayTime(enteredStageAt)}`}
          </p>
        )}
      </div>

      {canManage && (
        <div className="grid w-full grid-cols-[auto_auto_minmax(0,1fr)] gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          {flow.lost && (
            <Button variant="danger" icon={pending === "reject" ? undefined : UserX} loading={pending === "reject"} disabled={busy} onClick={onOpenReject}>
              Reprovar
            </Button>
          )}

          {flow.status === "OPEN" && (
            <Button
              variant="secondary"
              icon={ChevronsRight}
              disabled={busy || !onKeep}
              onClick={onKeep ?? undefined}
              title={onKeep ? "Mantém na etapa atual e abre o próximo candidato (J)" : "Não há próximo candidato na fila"}
            >
              Manter
              <span className="sr-only"> na etapa e ver o próximo candidato</span>
            </Button>
          )}

          {flow.status === "OPEN" && flow.next && (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => onChangeStage(flow.next as FlowStage, "advance")}
              aria-busy={pending === "advance" || undefined}
              className="max-w-full"
            >
              {pending === "advance" && <Loader2 className="animate-spin" aria-hidden />}
              <span className="truncate">
                {pending === "advance" ? (
                  "Movendo…"
                ) : (
                  <>
                    Avançar<span className="hidden sm:inline"> para {flow.next.name}</span>
                    <span className="sr-only sm:hidden"> para {flow.next.name}</span>
                  </>
                )}
              </span>
              {pending !== "advance" && <ArrowRight aria-hidden />}
            </Button>
          )}

          {(flow.status === "LOST" || flow.status === "OFF_PIPELINE") && flow.resumeTo && (
            <Button
              variant={flow.status === "LOST" ? "secondary" : "primary"}
              icon={RotateCcw}
              loading={pending === "resume"}
              disabled={busy}
              onClick={() => onChangeStage(flow.resumeTo as FlowStage, "resume")}
              className="col-span-2"
            >
              {flow.status === "LOST" ? `Reabrir em ${flow.resumeTo.name}` : `Retomar em ${flow.resumeTo.name}`}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
