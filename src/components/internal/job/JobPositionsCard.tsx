"use client";

// Card "Posições" da vaga: quantas contratações este processo seletivo entrega, quem ocupa
// cada uma e o que aconteceu com ela. Toda ação chama uma função do banco (com trava de
// linha e histórico) via server action — nada é apagado, só cancelado ou liberado.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronDown,
  ExternalLink,
  MoreHorizontal,
  Plus,
  RotateCcw,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button, buttonVariants } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Dialog } from "@/components/ui/Dialog";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import {
  POSITION_STATUS_META,
  canAddPosition,
  canCancelPosition,
  occupiedApplicationIds,
  positionLabel,
  progressLabel,
  sortPositions,
  summarizePositions,
  type JobPosition,
  type PositionsSummary,
} from "@/lib/jobs/positions";
import { positionHistory, type JobEventRow } from "@/lib/jobs/history";
import { formatStoredDate } from "@/lib/jobs/deadlines";
import {
  addPositionAction,
  cancelPositionAction,
  fillPositionAction,
  releasePositionAction,
  type PositionActionResult,
} from "@/lib/jobs/position-actions";
import { inputClass } from "./JobFields";

export interface HireCandidate {
  applicationId: string;
  fullName: string;
  stageName: string;
}

interface Props {
  jobId: string;
  isTalentPool: boolean;
  positions: JobPosition[];
  events: JobEventRow[];
  /** Candidatos em etapa de admissão/contratado que ainda não ocupam posição. */
  hireCandidates: HireCandidate[];
  /** Quantidade aprovada na solicitação (null = vaga avulsa ou não informada). */
  approvedOpenings: number | null;
  requestCode: string | null;
  canManage: boolean;
  /** Chamado quando todas as posições ficaram preenchidas após uma ação. */
  onAllFilled?: () => void;
}

type DialogState =
  | { kind: "add" }
  | { kind: "cancel"; position: JobPosition }
  | { kind: "release"; position: JobPosition }
  | { kind: "fill"; position: JobPosition }
  | null;

const RELEASE_REASONS = [
  "Desistência do candidato",
  "Não compareceu à admissão",
  "Reprovado no exame admissional",
  "Contratação cancelada pela empresa",
];

function formatDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function JobPositionsCard({
  jobId,
  isTalentPool,
  positions,
  events,
  hireCandidates,
  approvedOpenings,
  requestCode,
  canManage,
  onAllFilled,
}: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [pending, startTransition] = useTransition();

  const summary = useMemo(() => summarizePositions(positions), [positions]);
  const sorted = useMemo(() => sortPositions(positions), [positions]);
  const active = sorted.filter((p) => p.status !== "CANCELLED");
  const cancelled = sorted.filter((p) => p.status === "CANCELLED");
  const occupied = useMemo(() => occupiedApplicationIds(positions), [positions]);
  const available = hireCandidates.filter((c) => !occupied.has(c.applicationId));
  const scopeChanged = approvedOpenings != null && approvedOpenings !== summary.total;

  function run(fn: () => Promise<PositionActionResult>, ok: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        notify("error", res.error);
        return;
      }
      notify("success", ok);
      setDialog(null);
      router.refresh();
      if (res.summary.allFilled) onAllFilled?.();
    });
  }

  if (isTalentPool) {
    return (
      <Panel title="Posições" description="Banco de talentos não tem posições: a coleta de currículos fica aberta continuamente.">
        <p className="text-body text-wg-ink-muted">
          Para contratar por esta oportunidade com número de vagas definido, mude o tipo para <strong>Vaga específica</strong>.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      id="posicoes"
      title="Posições"
      meta={<PositionsMeta summary={summary} />}
      description="Número de profissionais que serão contratados por meio deste processo seletivo."
      action={
        canManage && canAddPosition({ isTalentPool }).ok ? (
          <Button size="sm" icon={Plus} onClick={() => setDialog({ kind: "add" })}>
            Adicionar posição
          </Button>
        ) : null
      }
    >
      <div className="mb-4">
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-meta">
          <span className="font-semibold text-wg-ink">{progressLabel(summary)}</span>
          {scopeChanged && (
            <span className="text-warning-fg" title={requestCode ? `Aprovado na ${requestCode}` : undefined}>
              Originalmente aprovado: {approvedOpenings}
            </span>
          )}
        </div>
        <ProgressBar value={summary.percent} label="Posições preenchidas" tone={summary.state === "ALL_FILLED" ? "success" : "brand"} />
      </div>

      <ul className="divide-y divide-wg-border-lighter rounded-control border border-wg-border-lighter">
        {active.map((p) => (
          <PositionRow
            key={p.id}
            jobId={jobId}
            position={p}
            history={positionHistory(events, p.id)}
            canManage={canManage}
            canCancel={canCancelPosition(p, positions)}
            onFill={() => setDialog({ kind: "fill", position: p })}
            onCancel={() => setDialog({ kind: "cancel", position: p })}
            onRelease={() => setDialog({ kind: "release", position: p })}
          />
        ))}
      </ul>

      {cancelled.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCancelled((v) => !v)}
            aria-expanded={showCancelled}
            className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-meta font-medium text-wg-ink-muted hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showCancelled && "rotate-180")} aria-hidden />
            {showCancelled ? "Ocultar" : "Mostrar"} {cancelled.length === 1 ? "1 posição cancelada" : `${cancelled.length} posições canceladas`}
          </button>
          {showCancelled && (
            <ul className="mt-2 space-y-1.5">
              {cancelled.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-control bg-wg-bg px-3 py-2 text-meta text-wg-ink-muted">
                  <span className="font-mono font-semibold text-wg-ink-secondary">{positionLabel(p.positionNumber)}</span>
                  <StatusBadge tone="neutral">Cancelada</StatusBadge>
                  <span>
                    {formatDay(p.cancelledAt)}
                    {p.cancelledBy ? ` · por ${p.cancelledBy}` : ""}
                    {p.cancelReason ? ` · ${p.cancelReason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Diálogos ── */}
      <AddPositionDialog
        open={dialog?.kind === "add"}
        busy={pending}
        summary={summary}
        approvedOpenings={approvedOpenings}
        requestCode={requestCode}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => run(() => addPositionAction(jobId, reason), "Posição adicionada.")}
      />
      <ReasonDialog
        open={dialog?.kind === "cancel"}
        busy={pending}
        title={dialog?.kind === "cancel" ? `Cancelar posição ${positionLabel(dialog.position.positionNumber)}` : ""}
        description="A posição deixa de contar no número de posições, mas continua no histórico da vaga."
        warning={
          approvedOpenings != null && summary.total - 1 < approvedOpenings
            ? `Esta vaga foi aprovada originalmente para ${approvedOpenings} ${approvedOpenings === 1 ? "posição" : "posições"}. Cancelar reduz o escopo da solicitação aprovada.`
            : null
        }
        placeholder="Ex.: demanda revista pelo gestor"
        confirmLabel="Cancelar posição"
        destructive
        onClose={() => setDialog(null)}
        onConfirm={(reason) =>
          dialog?.kind === "cancel" && run(() => cancelPositionAction(jobId, dialog.position.id, reason), "Posição cancelada.")
        }
      />
      <ReasonDialog
        open={dialog?.kind === "release"}
        busy={pending}
        title={dialog?.kind === "release" ? `Liberar posição ${positionLabel(dialog.position.positionNumber)}` : ""}
        description={
          dialog?.kind === "release"
            ? `${dialog.position.candidateName ?? "O candidato"} deixa de ocupar a posição, que volta a ficar em aberto. A movimentação fica no histórico; a admissão (se houver) não é apagada — trate-a em Admissões.`
            : ""
        }
        presets={RELEASE_REASONS}
        placeholder="Descreva o motivo"
        confirmLabel="Liberar posição"
        onClose={() => setDialog(null)}
        onConfirm={(reason) =>
          dialog?.kind === "release" &&
          run(() => releasePositionAction(jobId, dialog.position.id, reason), "Posição liberada e reaberta.")
        }
      />
      <FillPositionDialog
        open={dialog?.kind === "fill"}
        busy={pending}
        jobId={jobId}
        position={dialog?.kind === "fill" ? dialog.position : null}
        candidates={available}
        onClose={() => setDialog(null)}
        onConfirm={(applicationId, date) =>
          dialog?.kind === "fill" &&
          run(() => fillPositionAction(jobId, dialog.position.id, applicationId, date), "Contratado vinculado à posição.")
        }
      />
    </Panel>
  );
}

function PositionsMeta({ summary }: { summary: PositionsSummary }) {
  return (
    <>
      {summary.total} {summary.total === 1 ? "posição" : "posições"} · {summary.filled}{" "}
      {summary.filled === 1 ? "preenchida" : "preenchidas"} · {summary.open} em aberto
    </>
  );
}

function PositionRow({
  jobId,
  position: p,
  history,
  canManage,
  canCancel,
  onFill,
  onCancel,
  onRelease,
}: {
  jobId: string;
  position: JobPosition;
  history: ReturnType<typeof positionHistory>;
  canManage: boolean;
  canCancel: ReturnType<typeof canCancelPosition>;
  onFill: () => void;
  onCancel: () => void;
  onRelease: () => void;
}) {
  const meta = POSITION_STATUS_META[p.status];
  const lastRelease = history.find((h) => h.kind === "position_released");
  const filled = p.status === "FILLED";

  const menu: DropdownMenuItem[] = filled
    ? [
        ...(p.admissionId ? [{ label: "Ver admissão", icon: ExternalLink, href: `/admissoes/${p.admissionId}` }] : []),
        { label: "Liberar posição (desistência)", icon: RotateCcw, onSelect: onRelease, danger: true },
      ]
    : [
        { label: "Vincular contratado", icon: UserPlus, onSelect: onFill },
        { type: "separator" as const },
        {
          label: "Cancelar posição",
          icon: XCircle,
          onSelect: onCancel,
          danger: true,
          disabled: !canCancel.ok,
          hint: !canCancel.ok ? "indisponível" : undefined,
        },
      ];

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-wg-bg/60">
      <div className="flex w-[124px] shrink-0 items-center gap-2">
        <span className="font-mono text-sm font-semibold text-wg-ink">{positionLabel(p.positionNumber)}</span>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      </div>

      <div className="min-w-0 flex-1 basis-48">
        {filled ? (
          <>
            <p className="flex items-center gap-1.5 text-body font-medium text-wg-ink">
              <UserCheck className="h-4 w-4 shrink-0 text-success-fg" aria-hidden />
              <span className="truncate">{p.candidateName}</span>
            </p>
            <p className="mt-0.5 text-meta text-wg-ink-muted">
              Contratado em {formatDay(p.filledAt)}
              {p.expectedStartDate && (
                <>
                  {" · "}
                  <CalendarClock className="inline h-3 w-3 -translate-y-px" aria-hidden /> Início previsto{" "}
                  {formatStoredDate(p.expectedStartDate)}
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-body text-wg-ink-muted">Nenhum candidato contratado.</p>
        )}
        {lastRelease && (
          <p className="mt-1 text-meta text-wg-ink-muted">
            <RotateCcw className="mr-1 inline h-3 w-3 -translate-y-px" aria-hidden />
            {lastRelease.details[0]} — contratação cancelada em {formatDay(lastRelease.at)}
            {lastRelease.details[1] ? ` (${lastRelease.details[1].replace(/^Motivo: /, "")})` : ""}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {filled && p.applicationId ? (
          <Link
            href={`/vagas/${jobId}/candidatos?candidato=${p.applicationId}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Ver candidato
          </Link>
        ) : !filled ? (
          <Link href={`/vagas/${jobId}/candidatos`} className={buttonVariants({ variant: "tertiary", size: "sm" })}>
            <Users aria-hidden />
            Ver candidatos
          </Link>
        ) : null}
        {canManage && (
          <DropdownMenu
            trigger={<MoreHorizontal aria-hidden />}
            ariaLabel={`Ações da posição ${positionLabel(p.positionNumber)}`}
            triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
            items={menu}
            align="right"
          />
        )}
      </div>
    </li>
  );
}

function AddPositionDialog({
  open,
  busy,
  summary,
  approvedOpenings,
  requestCode,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  summary: PositionsSummary;
  approvedOpenings: number | null;
  requestCode: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const exceeds = approvedOpenings != null && summary.total + 1 > approvedOpenings;
  const next = summary.total + 1;
  return (
    <Dialog
      open={open}
      onClose={() => {
        setReason("");
        onClose();
      }}
      busy={busy}
      title="Adicionar posição"
      description={`O número de posições passa de ${summary.total} para ${next}. A nova posição entra em aberto e compartilha descrição, pipeline e candidatos desta vaga.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={exceeds && !reason.trim()}
            onClick={() => {
              onConfirm(reason);
              setReason("");
            }}
          >
            Adicionar posição
          </Button>
        </>
      }
    >
      {exceeds && (
        <p className="mb-3 rounded-control border border-warning-border bg-warning-bg px-3 py-2 text-meta text-warning-fg">
          Esta vaga foi aprovada originalmente para {approvedOpenings} {approvedOpenings === 1 ? "posição" : "posições"}
          {requestCode ? ` (${requestCode})` : ""}. Adicionar uma posição modifica o escopo da solicitação aprovada — informe o motivo.
        </p>
      )}
      <label className="mb-1 block text-[13px] font-medium text-wg-ink-secondary" htmlFor="add-position-reason">
        Motivo {exceeds ? <span className="text-danger-fg">*</span> : <span className="font-normal text-wg-ink-muted">(opcional)</span>}
      </label>
      <textarea
        id="add-position-reason"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ex.: aumento de demanda aprovado pela diretoria"
        className={cn(inputClass, "h-auto py-2")}
      />
      <p className="mt-2 text-meta text-wg-ink-muted">Fica registrado no histórico: quem alterou, quando, o motivo e a quantidade anterior e nova.</p>
    </Dialog>
  );
}

function ReasonDialog({
  open,
  busy,
  title,
  description,
  warning,
  presets,
  placeholder,
  confirmLabel,
  destructive,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  title: string;
  description: string;
  warning?: string | null;
  presets?: string[];
  placeholder: string;
  confirmLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const close = () => {
    setReason("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      busy={busy}
      alert={destructive}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Voltar
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            loading={busy}
            disabled={!reason.trim()}
            onClick={() => {
              onConfirm(reason);
              setReason("");
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {warning && (
        <p className="mb-3 rounded-control border border-warning-border bg-warning-bg px-3 py-2 text-meta text-warning-fg">{warning}</p>
      )}
      {presets && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReason(p)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                reason === p
                  ? "border-wg-green bg-wg-sidebar text-wg-green-dark"
                  : "border-wg-border-light bg-white text-wg-ink-secondary hover:bg-wg-bg"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <label className="mb-1 block text-[13px] font-medium text-wg-ink-secondary" htmlFor="position-reason">
        Motivo <span className="text-danger-fg">*</span>
      </label>
      <textarea
        id="position-reason"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, "h-auto py-2")}
      />
    </Dialog>
  );
}

function FillPositionDialog({
  open,
  busy,
  jobId,
  position,
  candidates,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  jobId: string;
  position: JobPosition | null;
  candidates: HireCandidate[];
  onClose: () => void;
  onConfirm: (applicationId: string, expectedStartDate: string | null) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [date, setDate] = useState("");
  const close = () => {
    setSelected("");
    setDate("");
    onClose();
  };
  const chosen = selected || (candidates.length === 1 ? candidates[0].applicationId : "");
  return (
    <Dialog
      open={open}
      onClose={close}
      busy={busy}
      title={position ? `Vincular contratado à posição ${positionLabel(position.positionNumber)}` : ""}
      description="Use para quem já foi contratado sem passar pelo “Iniciar admissão” do pipeline. Para novas contratações, mova o candidato para a etapa de admissão no pipeline — a posição é escolhida lá."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} disabled={!chosen} onClick={() => onConfirm(chosen, date || null)}>
            Confirmar contratação
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <div className="rounded-control border border-dashed border-wg-border-light px-4 py-5 text-center">
          <p className="text-body font-medium text-wg-ink">Nenhum candidato em etapa de contratação</p>
          <p className="mt-1 text-meta text-wg-ink-muted">
            Só candidatos nas etapas de admissão/contratado (e que ainda não ocupam posição) aparecem aqui.
          </p>
          <Link href={`/vagas/${jobId}/candidatos`} className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-3" })}>
            Abrir pipeline
          </Link>
        </div>
      ) : (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-wg-ink-secondary">Candidato contratado</legend>
          <div className="space-y-1.5">
            {candidates.map((c) => (
              <label
                key={c.applicationId}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2 transition-colors",
                  chosen === c.applicationId ? "border-wg-green bg-wg-sidebar/60" : "border-wg-border-light hover:bg-wg-bg"
                )}
              >
                <input
                  type="radio"
                  name="fill-candidate"
                  checked={chosen === c.applicationId}
                  onChange={() => setSelected(c.applicationId)}
                  className="h-4 w-4 accent-wg-green"
                />
                <span className="min-w-0 flex-1 truncate text-body font-medium text-wg-ink">{c.fullName}</span>
                <span className="shrink-0 text-meta text-wg-ink-muted">{c.stageName}</span>
              </label>
            ))}
          </div>
          <label className="mb-1 mt-4 block text-[13px] font-medium text-wg-ink-secondary" htmlFor="fill-date">
            Data prevista de admissão <span className="font-normal text-wg-ink-muted">(opcional)</span>
          </label>
          <input id="fill-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputClass, "max-w-[200px]")} />
        </fieldset>
      )}
    </Dialog>
  );
}
