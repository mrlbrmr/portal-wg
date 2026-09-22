// Linha do tempo da candidatura — módulo PURO.
//
// Junta eventos REAIS de fontes que já existem no banco: criação da candidatura,
// application_stage_history (troca de etapa, com autor), application_assessments
// (avaliações, entrevistas, análise de IA), assessment_sessions (teste enviado/concluído)
// e application_notes (anotações). Tipos sem fonte de dado hoje (contato realizado,
// troca de responsável) já existem no vocabulário para a UI, mas nunca são gerados aqui.

export type CandidateEventType =
  | "APPLICATION_RECEIVED"
  | "STAGE_CHANGED"
  | "REJECTED"
  | "CONTACT_MADE"
  | "TEST_SENT"
  | "TEST_COMPLETED"
  | "ASSESSMENT_CREATED"
  | "AI_ANALYSIS"
  | "NOTE_ADDED"
  | "INTERVIEW_SCHEDULED"
  | "OWNER_CHANGED";

export interface CandidateEvent {
  id: string;
  type: CandidateEventType;
  /** ISO do momento em que aconteceu. */
  at: string;
  title: string;
  /** Linha secundária curta (etapas, nome do teste, trecho da anotação). */
  detail: string | null;
  /** Quem fez (quando o sistema registra). */
  actor: string | null;
}

export interface TimelineInput {
  createdAt: string;
  /** Origem já traduzida ("Portal", "Indicação"…). */
  sourceLabel: string;
  addedBy: string | null;
  stageHistory: Array<{ id: string; stageId: string | null; stage: { name: string } | null; changedBy: string; changedAt: string }>;
  lostStageId: string | null;
  assessments?: Array<{
    id: string;
    kind: string;
    source: string;
    title: string | null;
    score: number | null;
    evaluator: string | null;
    occurredAt: string | null;
    createdAt: string;
    createdBy?: string | null;
  }>;
  sessions?: Array<{
    id: string;
    template: { name: string } | null;
    submittedAt: string | null;
    sentBy: string | null;
    createdAt: string;
  }>;
  notes?: Array<{ id: string; body: string; authorName: string; createdAt: string }>;
  /** Rótulos dos tipos de avaliação (ASSESSMENT_KIND_LABELS). */
  kindLabels?: Record<string, string>;
}

const TZ = "America/Sao_Paulo";
/** Até quanto tempo após a criação o 1º registro do histórico é a própria entrada. */
const INTAKE_WINDOW_MS = 5 * 60_000;

function excerpt(s: string, max = 140): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

const ms = (iso: string) => new Date(iso).getTime();

function dayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
}

export function buildCandidateTimeline(input: TimelineInput): CandidateEvent[] {
  const events: CandidateEvent[] = [];
  const history = [...input.stageHistory].sort((a, b) => ms(a.changedAt) - ms(b.changedAt));
  const createdMs = new Date(input.createdAt).getTime();
  const firstIsIntake =
    history.length > 0 && Math.abs(new Date(history[0].changedAt).getTime() - createdMs) < INTAKE_WINDOW_MS;

  events.push({
    id: "created",
    type: "APPLICATION_RECEIVED",
    at: firstIsIntake ? history[0].changedAt : input.createdAt,
    title: "Candidatura recebida",
    detail: `Via ${input.sourceLabel}`,
    actor:
      input.addedBy ??
      (firstIsIntake && history[0].changedBy && !/candidato/i.test(history[0].changedBy) ? history[0].changedBy : null),
  });

  history.forEach((h, i) => {
    if (i === 0 && firstIsIntake) return;
    const to = h.stage?.name ?? "etapa removida";
    const from = i > 0 ? history[i - 1].stage?.name ?? null : null;
    const rejected = input.lostStageId !== null && h.stageId === input.lostStageId;
    events.push({
      id: `stage-${h.id}`,
      type: rejected ? "REJECTED" : "STAGE_CHANGED",
      at: h.changedAt,
      title: rejected ? "Candidatura reprovada" : "Etapa alterada",
      detail: from ? `${from} → ${to}` : to,
      actor: h.changedBy || null,
    });
  });

  for (const a of input.assessments ?? []) {
    // Big Five respondido gera uma avaliação automática — o evento já vem da sessão.
    if (a.kind === "PERSONALITY_TEST" && a.evaluator === "Automático") continue;
    if (a.kind === "AI_FIT" && a.source === "AI") {
      events.push({
        id: `assessment-${a.id}`,
        type: "AI_ANALYSIS",
        at: a.occurredAt ?? a.createdAt,
        title: "Análise de currículo por IA",
        detail: a.score !== null ? `${Math.round(a.score)}% de aderência` : null,
        actor: null,
      });
      continue;
    }
    if (a.kind === "INTERVIEW") {
      events.push({
        id: `assessment-${a.id}`,
        type: "INTERVIEW_SCHEDULED",
        at: a.createdAt,
        title: "Entrevista registrada",
        detail: a.occurredAt ? `Para ${dayMonth(a.occurredAt)}` : null,
        actor: a.createdBy ?? a.evaluator ?? null,
      });
      continue;
    }
    events.push({
      id: `assessment-${a.id}`,
      type: "ASSESSMENT_CREATED",
      at: a.createdAt,
      title: "Avaliação registrada",
      detail: a.title || input.kindLabels?.[a.kind] || a.kind,
      actor: a.createdBy ?? a.evaluator ?? null,
    });
  }

  for (const s of input.sessions ?? []) {
    const name = s.template?.name ?? "Teste";
    events.push({ id: `test-sent-${s.id}`, type: "TEST_SENT", at: s.createdAt, title: "Teste enviado", detail: name, actor: s.sentBy });
    if (s.submittedAt) {
      events.push({
        id: `test-done-${s.id}`,
        type: "TEST_COMPLETED",
        at: s.submittedAt,
        title: "Teste concluído",
        detail: name,
        actor: null,
      });
    }
  }

  for (const n of input.notes ?? []) {
    events.push({
      id: `note-${n.id}`,
      type: "NOTE_ADDED",
      at: n.createdAt,
      title: "Anotação adicionada",
      detail: excerpt(n.body),
      actor: n.authorName,
    });
  }

  return events.sort((a, b) => ms(b.at) - ms(a.at));
}

/** Agrupa eventos (já ordenados) por dia no fuso de São Paulo: "Hoje", "Ontem", "21 set.". */
export function groupEventsByDay<T extends { at: string }>(
  events: T[],
  now: Date = new Date()
): Array<{ key: string; label: string; items: T[] }> {
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const today = key(now);
  const yesterday = key(new Date(now.getTime() - 86_400_000));
  const groups: Array<{ key: string; label: string; items: T[] }> = [];
  for (const e of events) {
    const d = new Date(e.at);
    const k = key(d);
    const last = groups[groups.length - 1];
    if (last && last.key === k) {
      last.items.push(e);
      continue;
    }
    const sameYear = k.slice(0, 4) === today.slice(0, 4);
    const label =
      k === today
        ? "Hoje"
        : k === yesterday
        ? "Ontem"
        : d.toLocaleDateString("pt-BR", {
            timeZone: TZ,
            day: "numeric",
            month: "short",
            ...(sameYear ? {} : { year: "numeric" }),
          });
    groups.push({ key: k, label, items: [e] });
  }
  return groups;
}
