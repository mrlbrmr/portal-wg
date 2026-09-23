// Linha do tempo da vaga — módulo PURO.
//
// Junta as três fontes reais de histórico, sem inventar nada:
//   • job_status_history — cada mudança de status (Rascunho → Recebendo candidaturas…);
//   • job_events         — criação, posições (adicionada/cancelada/preenchida/liberada),
//                          alterações de campos, migração;
//   • jobs.createdAt     — só para vagas antigas sem nenhum registro de criação.

import { isPublicJobStatus } from "@/lib/utils";
import { JOB_PROCESS_STATUS_LABELS } from "@/lib/recruitment/job-presentation";
import { positionLabel } from "./positions";
import type { FieldChange } from "./field-changes";
import type { Tone } from "@/components/ui/StatusBadge";

export interface StatusHistoryRow {
  id: string;
  status: string;
  changedBy: string;
  changedAt: string;
}

export interface JobEventRow {
  id: string;
  type: string;
  positionId: string | null;
  reason: string | null;
  data: Record<string, unknown>;
  actorName: string;
  createdAt: string;
}

export type HistoryKind =
  | "created"
  | "status"
  | "published"
  | "paused"
  | "closed"
  | "cancelled"
  | "position_added"
  | "position_cancelled"
  | "position_filled"
  | "position_released"
  | "fields"
  | "migration";

export interface HistoryItem {
  id: string;
  at: string;
  kind: HistoryKind;
  title: string;
  /** Linhas de detalhe (motivo, de → para, candidato). */
  details: string[];
  actor: string | null;
  tone: Tone;
}

const statusLabel = (s: string) => JOB_PROCESS_STATUS_LABELS[s] ?? s;

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function statusItem(entry: StatusHistoryRow, prev: StatusHistoryRow | undefined): HistoryItem {
  const from = prev?.status;
  const to = entry.status;
  const base = { id: `s-${entry.id}`, at: entry.changedAt, actor: entry.changedBy || null };
  const transition = from ? [`${statusLabel(from)} → ${statusLabel(to)}`] : [];
  if (isPublicJobStatus(to) && (!from || !isPublicJobStatus(from))) {
    return { ...base, kind: "published", title: "Vaga publicada", details: transition, tone: "success" };
  }
  if (to === "PAUSED") return { ...base, kind: "paused", title: "Vaga pausada", details: transition, tone: "warning" };
  if (to === "FILLED") return { ...base, kind: "closed", title: "Vaga encerrada", details: transition, tone: "info" };
  if (to === "CLOSED") return { ...base, kind: "cancelled", title: "Vaga cancelada", details: transition, tone: "neutral" };
  return { ...base, kind: "status", title: "Status alterado", details: transition, tone: "info" };
}

function eventItem(e: JobEventRow): HistoryItem | null {
  const d = e.data ?? {};
  const base = { id: `e-${e.id}`, at: e.createdAt, actor: e.actorName || null };
  const n = num(d.number);
  const pos = n != null ? positionLabel(n) : "";
  const reason = e.reason ? [`Motivo: ${e.reason}`] : [];
  switch (e.type) {
    case "JOB_CREATED": {
      const code = str(d.requestCode);
      const positions = num(d.positions);
      return {
        ...base,
        kind: "created",
        title: "Vaga criada",
        details: [
          ...(code ? [`Originada da ${code}`] : d.source === "duplicate" ? ["Duplicada de outra vaga"] : []),
          ...(positions ? [`${positions} ${positions === 1 ? "posição" : "posições"}`] : []),
        ],
        tone: "success",
      };
    }
    case "POSITIONS_MIGRATED": {
      const total = num(d.positions) ?? 0;
      const filled = num(d.filled) ?? 0;
      return {
        ...base,
        kind: "migration",
        title: "Posições criadas a partir da quantidade de vagas",
        details: [
          `${total} ${total === 1 ? "posição" : "posições"}${filled ? ` · ${filled} preenchida${filled === 1 ? "" : "s"} com contratados já registrados` : ""}`,
        ],
        tone: "neutral",
      };
    }
    case "POSITION_ADDED": {
      const from = num(d.from);
      const to = num(d.to);
      return {
        ...base,
        kind: "position_added",
        title: `Posição ${pos} adicionada`,
        details: [...(from != null && to != null ? [`Quantidade de posições alterada de ${from} para ${to}`] : []), ...reason],
        tone: "info",
      };
    }
    case "POSITION_CANCELLED": {
      const from = num(d.from);
      const to = num(d.to);
      return {
        ...base,
        kind: "position_cancelled",
        title: `Posição ${pos} cancelada`,
        details: [...(from != null && to != null ? [`Quantidade de posições alterada de ${from} para ${to}`] : []), ...reason],
        tone: "neutral",
      };
    }
    case "POSITION_FILLED":
      return {
        ...base,
        kind: "position_filled",
        title: `Posição ${pos} preenchida`,
        details: [str(d.candidateName) ?? "Candidato"],
        tone: "success",
      };
    case "POSITION_RELEASED":
      return {
        ...base,
        kind: "position_released",
        title: `Contratação cancelada — posição ${pos} reaberta`,
        details: [str(d.candidateName) ?? "Candidato", ...reason],
        tone: "warning",
      };
    case "FIELDS_UPDATED": {
      const changes = (Array.isArray(d.changes) ? d.changes : []) as FieldChange[];
      if (changes.length === 0) return null;
      return {
        ...base,
        kind: "fields",
        title: changes.length === 1 ? `${changes[0].label} alterado` : "Dados da vaga alterados",
        details: [
          ...changes.map((c) =>
            c.field === "description" ? "Descrição da vaga atualizada" : `${c.label}: ${c.from ?? "vazio"} → ${c.to ?? "vazio"}`
          ),
          ...reason,
        ],
        tone: "neutral",
      };
    }
    default:
      return null;
  }
}

export function buildJobHistory(input: {
  createdAt: string;
  statusHistory: StatusHistoryRow[];
  events: JobEventRow[];
}): HistoryItem[] {
  const items: HistoryItem[] = [];
  const hasCreatedEvent = input.events.some((e) => e.type === "JOB_CREATED");
  const statuses = [...input.statusHistory].sort((a, b) => a.changedAt.localeCompare(b.changedAt));

  statuses.forEach((entry, i) => {
    if (i === 0) {
      // O primeiro registro é o status de nascimento da vaga.
      if (hasCreatedEvent) return;
      items.push({
        id: `s-${entry.id}`,
        at: entry.changedAt,
        kind: "created",
        title: "Vaga criada",
        details: [`Status inicial: ${statusLabel(entry.status)}`],
        actor: entry.changedBy || null,
        tone: "success",
      });
      return;
    }
    items.push(statusItem(entry, statuses[i - 1]));
  });

  for (const e of input.events) {
    const item = eventItem(e);
    if (item) items.push(item);
  }

  if (!hasCreatedEvent && statuses.length === 0) {
    items.push({ id: "created", at: input.createdAt, kind: "created", title: "Vaga criada", details: [], actor: null, tone: "success" });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** Histórico de UMA posição (para o card: "João — contratação cancelada"). */
export function positionHistory(events: JobEventRow[], positionId: string): HistoryItem[] {
  return events
    .filter((e) => e.positionId === positionId)
    .map(eventItem)
    .filter((x): x is HistoryItem => x !== null)
    .sort((a, b) => b.at.localeCompare(a.at));
}
