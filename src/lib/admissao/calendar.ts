// Eventos do Calendário de RH — módulo PURO (servidor, cliente e testes).
//
// Tudo sai de datas reais da admissão; nada de horário (o banco guarda só a data):
//   • start       — admissions.startDate
//   • exam        — admissions.medicalExamDate (ASO)
//   • birthday    — admissions.birthDate, repetido todo ano
//   • deadline    — prazo do link do formulário admissional ainda não preenchido
//                   (digitalFormExpiresAt) — "pendência / prazo importante"
//   • experience  — vencimentos do contrato de experiência: DESLIGADO enquanto a política
//                   não for definida (EXPERIENCE_CHECKPOINT_DAYS = null). Para ligar, informe
//                   os marcos em dias corridos desde o início (ex.: [45, 90]).

import type { Tone } from "@/components/ui/StatusBadge";
import { digitalFormState, DIGITAL_FORM_META } from "./overview";

export type CalendarKind = "start" | "exam" | "birthday" | "experience" | "deadline";

/** Marcos do contrato de experiência (dias desde o início). null = política não definida. */
export const EXPERIENCE_CHECKPOINT_DAYS: number[] | null = null;

export const CALENDAR_KINDS: Array<{ value: CalendarKind; label: string; plural: string; enabled: boolean }> = [
  { value: "start", label: "Início", plural: "inícios", enabled: true },
  { value: "exam", label: "Exame médico", plural: "exames médicos", enabled: true },
  { value: "deadline", label: "Prazo do formulário", plural: "prazos", enabled: true },
  { value: "experience", label: "Vencimento de experiência", plural: "vencimentos de experiência", enabled: EXPERIENCE_CHECKPOINT_DAYS !== null },
  { value: "birthday", label: "Aniversário", plural: "aniversários", enabled: true },
];

export function kindLabel(kind: CalendarKind): string {
  return CALENDAR_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export interface CalendarAdmission {
  id: string;
  fullName: string;
  startDate: string | null; // "AAAA-MM-DD"
  examDate: string | null;
  birthDate: string | null;
  positionName: string | null;
  companyId: string | null;
  companyName: string | null;
  branchId: string | null;
  branchName: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  stageName: string | null;
  stageColor: string | null;
  isFinal: boolean;
  digitalFormToken: boolean;
  digitalFormExpiresAt: string | null; // ISO
  digitalFormSubmittedAt: string | null; // ISO
}

export interface CalendarEvent {
  id: string;
  kind: CalendarKind;
  date: string; // "AAAA-MM-DD"
  admission: CalendarAdmission;
  status: { label: string; tone: Tone };
  /** Linha extra do detalhe ("Completa 32 anos", "45 dias de experiência"). */
  note?: string;
}

// ─── Datas "AAAA-MM-DD" (sem fuso: são datas de calendário) ─────────────────────

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Status de uma data agendada em relação a hoje — sem supor se aconteceu. */
function scheduleStatus(date: string, today: string): { label: string; tone: Tone } {
  if (date === today) return { label: "Hoje", tone: "info" };
  if (date > today) return { label: "Agendado", tone: "info" };
  return { label: "Data passada", tone: "neutral" };
}

/**
 * Eventos entre `from` e `to` (inclusive). Aniversários são gerados para cada ano do
 * intervalo (29/02 cai em 28/02 nos anos não bissextos).
 */
export function buildCalendarEvents(
  admissions: CalendarAdmission[],
  range: { from: string; to: string },
  today: string
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const inRange = (d: string) => d >= range.from && d <= range.to;
  const y0 = Number(range.from.slice(0, 4));
  const y1 = Number(range.to.slice(0, 4));

  for (const a of admissions) {
    if (a.startDate && inRange(a.startDate)) {
      out.push({
        id: `start-${a.id}`,
        kind: "start",
        date: a.startDate,
        admission: a,
        status: a.isFinal ? { label: "Admissão concluída", tone: "success" } : scheduleStatus(a.startDate, today),
      });
    }
    if (a.examDate && inRange(a.examDate)) {
      out.push({ id: `exam-${a.id}`, kind: "exam", date: a.examDate, admission: a, status: scheduleStatus(a.examDate, today) });
    }
    if (a.birthDate) {
      const [by, bm, bd] = a.birthDate.split("-").map(Number);
      for (let y = y0; y <= y1; y++) {
        const day = bm === 2 && bd === 29 && !isLeap(y) ? 28 : bd;
        const date = `${y}-${String(bm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (!inRange(date)) continue;
        const age = y - by;
        out.push({
          id: `birthday-${a.id}-${y}`,
          kind: "birthday",
          date,
          admission: a,
          status: { label: date === today ? "Hoje" : date > today ? "Próximo" : "Passou", tone: date === today ? "success" : "neutral" },
          note: age > 0 && age < 120 ? `Completa ${age} anos` : undefined,
        });
      }
    }
    if (EXPERIENCE_CHECKPOINT_DAYS && a.startDate) {
      for (const days of EXPERIENCE_CHECKPOINT_DAYS) {
        const date = addDays(a.startDate, days - 1);
        if (!inRange(date)) continue;
        out.push({
          id: `experience-${a.id}-${days}`,
          kind: "experience",
          date,
          admission: a,
          status: scheduleStatus(date, today),
          note: `${days} dias de experiência`,
        });
      }
    }
    // Prazo do formulário: só enquanto o candidato não preencheu (link enviado).
    if (a.digitalFormToken && !a.digitalFormSubmittedAt && a.digitalFormExpiresAt && !a.isFinal) {
      const date = ymd(new Date(a.digitalFormExpiresAt));
      if (inRange(date)) {
        const state = digitalFormState(
          { digitalFormToken: "1", digitalFormExpiresAt: a.digitalFormExpiresAt, digitalFormSubmittedAt: null },
          parseYmd(today)
        );
        const meta = DIGITAL_FORM_META[state];
        out.push({
          id: `deadline-${a.id}`,
          kind: "deadline",
          date,
          admission: a,
          status: { label: date === today ? "Vence hoje" : meta.label, tone: date === today ? "warning" : meta.tone },
          note: "Último dia para o candidato preencher o formulário admissional",
        });
      }
    }
  }

  const order: Record<CalendarKind, number> = { deadline: 0, exam: 1, start: 2, experience: 3, birthday: 4 };
  return out.sort(
    (x, y) => x.date.localeCompare(y.date) || order[x.kind] - order[y.kind] || x.admission.fullName.localeCompare(y.admission.fullName, "pt-BR")
  );
}

export interface CalendarFilters {
  company: string;
  branch: string;
  kind: string;
  responsible: string;
}

export const EMPTY_CALENDAR_FILTERS: CalendarFilters = { company: "", branch: "", kind: "", responsible: "" };

export function filterCalendarEvents(events: CalendarEvent[], f: CalendarFilters): CalendarEvent[] {
  return events.filter(
    (e) =>
      (!f.kind || e.kind === f.kind) &&
      (!f.company || e.admission.companyId === f.company) &&
      (!f.branch || e.admission.branchId === f.branch) &&
      (!f.responsible || (f.responsible === "none" ? !e.admission.responsibleId : e.admission.responsibleId === f.responsible))
  );
}

/** "2 inícios · 1 exame médico · 1 aniversário" (só tipos presentes, na ordem do catálogo). */
export function summarizeEvents(events: CalendarEvent[]): string {
  return CALENDAR_KINDS.map((k) => {
    const n = events.filter((e) => e.kind === k.value).length;
    if (n === 0) return null;
    return `${n} ${n === 1 ? k.label.toLowerCase() : k.plural}`;
  })
    .filter(Boolean)
    .join(" · ");
}

/** Grade mensal: semanas de domingo a sábado cobrindo o mês (datas fora do mês incluídas). */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const last = new Date(year, month + 1, 0);
  const weeks: string[][] = [];
  const cur = new Date(start);
  while (cur <= last || cur.getDay() !== 0) {
    if (cur.getDay() === 0) weeks.push([]);
    weeks[weeks.length - 1].push(ymd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return weeks;
}

/** Domingo da semana que contém `date`. */
export function weekStart(date: string): string {
  const d = parseYmd(date);
  return addDays(date, -d.getDay());
}
