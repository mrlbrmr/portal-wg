"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarX, FileText, MoreHorizontal, Plus, UserX } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { INTERVIEW_STATUSES, roundLabel, type InterviewRow } from "@/lib/recruitment/interviews/catalog";
import { cancelInterviewAction, markNoShowAction, type InterviewActionResult } from "@/lib/recruitment/interviews/actions";
import { formatInterviewWhen, isOverdue } from "@/lib/recruitment/interviews/rules";
import { DialogShell } from "../DialogShell";
import { Section } from "../Section";
import type { Loadable } from "../types";
import { InterviewScheduleDialog } from "./InterviewScheduleDialog";

interface Props {
  applicationId: string;
  interviews: Loadable<InterviewRow>;
  onInterviewsChange: (update: (items: InterviewRow[]) => InterviewRow[]) => void;
  onRetry: () => void;
  canManage: boolean;
  defaultInterviewer: string;
  /** "Registrar parecer" de uma entrevista agendada — o hub abre o editor de parecer. */
  onRegisterReport: (interview: InterviewRow) => void;
  /** Algo mudou no banco — o pipeline atualiza o sinal do card. */
  onChanged: () => void;
}

const byWhen = (a: InterviewRow, b: InterviewRow) => a.scheduledAt.localeCompare(b.scheduledAt);

function safeWhen(iso: string): string {
  try {
    return formatInterviewWhen(iso);
  } catch {
    return "Data inválida";
  }
}

function statusInfo(code: string) {
  return INTERVIEW_STATUSES.find((s) => s.code === code) ?? { code, label: code, tone: "neutral" as const };
}

const field =
  "mt-1 w-full resize-y rounded-control border border-wg-border-light bg-white px-2.5 py-2 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30";

/**
 * Agenda de entrevistas da candidatura (application_interviews): G&G e Gestor, em ordem
 * cronológica. O parecer continua sendo registrado em "Entrevistas e pareceres"; aqui só
 * se agenda, remarca, cancela, marca falta ou abre o parecer da entrevista.
 */
export function InterviewsSection({
  applicationId,
  interviews,
  onInterviewsChange,
  onRetry,
  canManage,
  defaultInterviewer,
  onRegisterReport,
  onChanged,
}: Props) {
  const { notify } = useToast();
  const [dialog, setDialog] = useState<{ existing: InterviewRow | null } | null>(null);
  const [toCancel, setToCancel] = useState<InterviewRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => [...(interviews.items ?? [])].sort(byWhen), [interviews.items]);
  const loading = interviews.items === null;
  const loadFailed = interviews.error && items.length === 0;
  const now = new Date();

  const replace = (row: InterviewRow) =>
    onInterviewsChange((list) => (list.some((i) => i.id === row.id) ? list.map((i) => (i.id === row.id ? row : i)) : [row, ...list]));

  const apply = (r: InterviewActionResult, success: string) => {
    if (!r.ok) {
      notify("error", r.error);
      // Mudou por fora (compare-and-swap): recarrega para mostrar o estado real.
      onRetry();
      return false;
    }
    replace(r.interview);
    notify("success", success);
    onChanged();
    return true;
  };

  const run = async (fn: () => Promise<InterviewActionResult>, success: string) => {
    setBusy(true);
    try {
      return apply(await fn(), success);
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    if (!toCancel) return;
    const ok = await run(() => cancelInterviewAction(toCancel.id, cancelReason), "Entrevista cancelada.");
    if (ok) {
      setToCancel(null);
      setCancelReason("");
    }
  };

  const itemMenu = (iv: InterviewRow) =>
    canManage && iv.status === "SCHEDULED" ? (
      <DropdownMenu
        trigger={<MoreHorizontal aria-hidden />}
        triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
        ariaLabel="Ações da entrevista"
        portal
        disabled={busy}
        items={[
          { label: "Registrar parecer", icon: FileText, onSelect: () => onRegisterReport(iv) },
          { label: "Remarcar", icon: CalendarClock, onSelect: () => setDialog({ existing: iv }) },
          { label: "Marcar falta", icon: UserX, onSelect: () => void run(() => markNoShowAction(iv.id), "Falta registrada.") },
          { type: "separator" },
          {
            label: "Cancelar",
            icon: CalendarX,
            danger: true,
            onSelect: () => {
              setCancelReason("");
              setToCancel(iv);
            },
          },
        ]}
      />
    ) : null;

  const scheduleButton = (variant: "tertiary" | "secondary") =>
    canManage ? (
      <Button size="sm" variant={variant} icon={Plus} onClick={() => setDialog({ existing: null })}>
        Agendar entrevista
      </Button>
    ) : null;

  return (
    <Section
      title="Entrevistas"
      meta={items.length > 0 ? <span className="text-meta font-normal tabular-nums text-wg-ink-muted">{items.length}</span> : null}
      action={items.length > 0 ? scheduleButton("tertiary") : null}
    >
      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando entrevistas agendadas">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : loadFailed ? (
        <p className="text-body text-danger-fg" role="alert">
          Não foi possível carregar as entrevistas.{" "}
          <button type="button" onClick={onRetry} className="font-semibold text-wg-green-dark hover:underline">
            Tentar novamente
          </button>
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={CalendarClock}
          title="Nenhuma entrevista agendada"
          description="Agende as entrevistas com Gente & Gestão e com o gestor para acompanhar a agenda do processo."
          action={scheduleButton("secondary")}
        />
      ) : (
        <ul className="divide-y divide-wg-border-lighter">
          {items.map((iv) => {
            const status = statusInfo(iv.status);
            const overdue = isOverdue(iv, now);
            return (
              <li key={iv.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-body font-medium text-wg-ink">{roundLabel(iv.round)}</span>
                    <span className="text-body tabular-nums text-wg-ink-secondary">{safeWhen(iv.scheduledAt)}</span>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    {overdue &&
                      (canManage ? (
                        <button
                          type="button"
                          onClick={() => onRegisterReport(iv)}
                          className="inline-flex h-[22px] items-center rounded-full bg-warning-bg px-2 text-[11.5px] font-semibold text-warning-fg hover:underline"
                        >
                          Registrar resultado
                        </button>
                      ) : (
                        <StatusBadge tone="warning">Registrar resultado</StatusBadge>
                      ))}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-wg-ink-muted">
                    {[iv.interviewerName, iv.location].filter(Boolean).join(" · ") || "Entrevistador e local não informados"}
                  </p>
                  {iv.status === "CANCELLED" && iv.cancelReason && (
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-wg-ink-muted">Motivo: {iv.cancelReason}</p>
                  )}
                  {iv.notes && iv.status === "SCHEDULED" && (
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-meta text-wg-ink-secondary">{iv.notes}</p>
                  )}
                </div>
                {itemMenu(iv)}
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <InterviewScheduleDialog
          applicationId={applicationId}
          existing={dialog.existing}
          defaultInterviewer={defaultInterviewer}
          onClose={() => setDialog(null)}
          onSaved={(row) => {
            replace(row);
            setDialog(null);
            onChanged();
          }}
        />
      )}

      <DialogShell
        open={toCancel !== null}
        tone="danger"
        title="Cancelar entrevista?"
        description="A entrevista fica no histórico como cancelada. Não é possível reabrir."
        busy={busy}
        onClose={() => setToCancel(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToCancel(null)} disabled={busy}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={() => void confirmCancel()} loading={busy}>
              Cancelar entrevista
            </Button>
          </>
        }
      >
        <label className="block text-[12px] font-medium text-wg-ink-muted">
          Motivo (opcional)
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} maxLength={500} className={field} />
        </label>
      </DialogShell>
    </Section>
  );
}
