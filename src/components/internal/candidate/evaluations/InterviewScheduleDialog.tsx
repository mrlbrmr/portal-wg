"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import { INTERVIEW_ROUNDS, type InterviewRow } from "@/lib/recruitment/interviews/catalog";
import { brtLocalToIso, formatInterviewWhen, isoToBrtLocal } from "@/lib/recruitment/interviews/rules";
import {
  scheduleInterviewAction,
  updateInterviewAction,
  type InterviewConflict,
} from "@/lib/recruitment/interviews/actions";
import { DialogShell } from "../DialogShell";

const field =
  "mt-1 h-9 w-full rounded-control border border-wg-border-light bg-white px-2.5 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30";
const area =
  "mt-1 w-full resize-y rounded-control border border-wg-border-light bg-white px-2.5 py-2 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30";
const labelCls = "block text-[12px] font-medium text-wg-ink-muted";

const DURATIONS = [15, 30, 45, 60, 90, 120];

interface Props {
  applicationId: string;
  /** Remarcar uma entrevista agendada (null = nova). */
  existing: InterviewRow | null;
  defaultInterviewer: string;
  onClose: () => void;
  onSaved: (item: InterviewRow, conflicts: InterviewConflict[]) => void;
}

/** Valor inicial do datetime-local: o horário salvo (em Brasília) ou vazio. Nunca quebra o diálogo. */
function initialWhen(existing: InterviewRow | null): string {
  if (!existing) return "";
  try {
    return isoToBrtLocal(existing.scheduledAt);
  } catch {
    return "";
  }
}

function safeWhen(iso: string): string {
  try {
    return formatInterviewWhen(iso);
  } catch {
    return "";
  }
}

/** Texto do aviso de conflito: "Fulano já tem entrevista com Maria às 12/11 · 14h". */
function conflictMessage(interviewer: string, conflicts: InterviewConflict[]): string {
  const who = interviewer.trim() || "O entrevistador";
  const list = conflicts
    .map((c) => {
      const at = safeWhen(c.scheduledAt);
      return at ? `${c.candidateName} às ${at}` : c.candidateName;
    })
    .join(", ");
  return `${who} já tem entrevista com ${list}. A entrevista foi salva mesmo assim.`;
}

/**
 * Agendar ou remarcar ENTREVISTA (G&G ou Gestor). Horário digitado em hora de Brasília.
 * Data passada só com "Entrevista já realizada". Conflito de agenda do entrevistador é
 * só aviso — a entrevista é salva mesmo assim.
 */
export function InterviewScheduleDialog({ applicationId, existing, defaultInterviewer, onClose, onSaved }: Props) {
  const { notify } = useToast();
  const [round, setRound] = useState<string>(existing?.round ?? INTERVIEW_ROUNDS[0].code);
  const [when, setWhen] = useState(() => initialWhen(existing));
  const [duration, setDuration] = useState(String(existing?.durationMin ?? 60));
  const [interviewer, setInterviewer] = useState(existing?.interviewerName ?? defaultInterviewer);
  const [location, setLocation] = useState(existing?.location ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  // Remarcar uma entrevista que já passou: o horário antigo não pode barrar o salvamento.
  const [alreadyHappened, setAlreadyHappened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durations = DURATIONS.includes(Number(duration)) ? DURATIONS : [...DURATIONS, Number(duration)].sort((a, b) => a - b);

  const save = async () => {
    if (saving) return;
    if (!when) {
      setError("Informe a data e a hora.");
      return;
    }
    let scheduledAt: string;
    try {
      scheduledAt = brtLocalToIso(when);
    } catch {
      setError("Data e hora inválidas.");
      return;
    }
    const isPast = new Date(scheduledAt).getTime() <= Date.now();
    if (isPast && !alreadyHappened && !existing) {
      setError("A data da entrevista deve ser futura. Se ela já aconteceu, marque \"Entrevista já realizada\".");
      return;
    }
    const input = {
      applicationId,
      round,
      scheduledAt,
      durationMin: Number(duration),
      location,
      interviewerName: interviewer,
      notes,
      // Edição de uma entrevista atrasada/passada também precisa passar pela validação.
      allowPast: alreadyHappened || (!!existing && isPast),
    };
    setSaving(true);
    setError(null);
    try {
      const r = existing ? await updateInterviewAction(existing.id, input) : await scheduleInterviewAction(input);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      notify("success", existing ? "Entrevista remarcada." : "Entrevista agendada.");
      if (r.conflicts.length > 0) notify("info", conflictMessage(r.interview.interviewerName ?? interviewer, r.conflicts));
      onSaved(r.interview, r.conflicts);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell
      open
      title={existing ? "Remarcar entrevista" : "Agendar entrevista"}
      description="Horário de Brasília."
      onClose={onClose}
      busy={saving}
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto self-center text-meta text-danger-fg">
              {error}
            </p>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving}>
            {existing ? "Salvar" : "Agendar"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            Rodada
            <select value={round} onChange={(e) => setRound(e.target.value)} className={field}>
              {INTERVIEW_ROUNDS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Duração
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className={field}>
              {durations.map((d) => (
                <option key={d} value={String(d)}>
                  {d < 60 ? `${d} min` : d % 60 === 0 ? `${d / 60} h` : `${Math.floor(d / 60)} h ${d % 60} min`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={cn(labelCls, "sm:w-1/2 sm:pr-1.5")}>
          Data e hora
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => {
              setWhen(e.target.value);
              setError(null);
            }}
            className={field}
            required
          />
        </label>
        <label className="flex items-center gap-2 text-meta text-wg-ink-secondary">
          <input
            type="checkbox"
            checked={alreadyHappened}
            onChange={(e) => {
              setAlreadyHappened(e.target.checked);
              setError(null);
            }}
            className="h-4 w-4 rounded border-wg-border-light accent-wg-green"
          />
          Entrevista já realizada (permite data passada)
        </label>
        <label className={labelCls}>
          Entrevistador
          <input value={interviewer} onChange={(e) => setInterviewer(e.target.value)} maxLength={120} className={field} autoComplete="off" />
        </label>
        <label className={labelCls}>
          Local ou link
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={500}
            placeholder="Ex.: Sala de reuniões da matriz ou link do Meet"
            className={field}
          />
        </label>
        <label className={labelCls}>
          Observações
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className={area} />
        </label>
        <button type="submit" hidden />
      </form>
    </DialogShell>
  );
}
