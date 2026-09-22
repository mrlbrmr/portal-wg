"use client";

import { forwardRef } from "react";
import { ArrowRight, Loader2, RotateCcw, UserX } from "lucide-react";
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
  onChangeStage: (stage: FlowStage, kind: StageActionKind) => void;
  onOpenReject: () => void;
}

const bar =
  "flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-wg-border-lighter bg-white px-4 py-2.5 shadow-[0_-6px_16px_-12px_rgba(26,34,19,.18)] sm:px-5";

/**
 * Barra de decisão fixa no rodapé do Quick View: onde o candidato está (etapa, próxima,
 * desde quando) + as decisões — Reprovar e Avançar. Permanecer na etapa já é "manter".
 * As ações vêm de candidate-stage-flow: só aparece o que o servidor aceita.
 */
export const CandidateStageBar = forwardRef<HTMLElement, Props>(function CandidateStageBar(
  { data, flow, canManage, pending, enteredStageAt, onChangeStage, onOpenReject },
  ref
) {
  if (!data || !flow) {
    return (
      <section ref={ref} aria-hidden className={bar}>
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-52" />
        </div>
        <Skeleton className="h-9 w-56" />
      </section>
    );
  }

  const busy = pending !== null;
  const stageName = data.stage?.name ?? "Sem etapa";
  const next = flow.status === "OPEN" ? flow.next : null;
  const statusLine =
    flow.status === "LOST"
      ? "Candidatura reprovada"
      : flow.status === "OFF_PIPELINE"
      ? "Fora do funil ativo"
      : flow.status === "FINAL"
      ? "Etapa final do processo"
      : next
      ? `Próxima: ${next.name}`
      : null;

  return (
    <section ref={ref} aria-label="Etapa e decisão" className={bar}>
      <div className="min-w-0 flex-1 basis-52 leading-tight">
        <p className="text-[11px] font-medium uppercase tracking-wide text-wg-ink-muted">
          Etapa do processo
          {flow.position && (
            <span className="normal-case tracking-normal tabular-nums">
              {" "}
              · {flow.position.index} de {flow.position.total}
            </span>
          )}
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-body font-semibold text-wg-ink">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: data.stage?.color ?? "#9AA68A" }} />
          <span className="truncate" title={stageName}>
            {stageName}
          </span>
        </p>
        {statusLine && (
          <p className="mt-0.5 truncate text-[12px] text-wg-ink-secondary" title={statusLine}>
            {statusLine}
          </p>
        )}
        {enteredStageAt && (
          <p className="truncate text-[12px] text-wg-ink-muted">Entrou nesta etapa {formatRelativeDayTime(enteredStageAt)}</p>
        )}
      </div>

      {canManage && (
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:max-w-[60%]">
          {flow.lost && (
            <Button variant="danger" icon={pending === "reject" ? undefined : UserX} loading={pending === "reject"} disabled={busy} onClick={onOpenReject}>
              Reprovar
            </Button>
          )}

          {next && (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => onChangeStage(next, "advance")}
              aria-busy={pending === "advance" || undefined}
              title={`Avançar para ${next.name}`}
              className="min-w-0 flex-1 !shrink sm:flex-initial"
            >
              {pending === "advance" && <Loader2 className="animate-spin" aria-hidden />}
              <span className="truncate">{pending === "advance" ? "Movendo…" : `Avançar para ${next.name}`}</span>
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
              title={`${flow.status === "LOST" ? "Reabrir" : "Retomar"} em ${flow.resumeTo.name}`}
              className="min-w-0 flex-1 !shrink sm:flex-initial"
            >
              <span className="truncate">
                {flow.status === "LOST" ? `Reabrir em ${flow.resumeTo.name}` : `Retomar em ${flow.resumeTo.name}`}
              </span>
            </Button>
          )}
        </div>
      )}
    </section>
  );
});
