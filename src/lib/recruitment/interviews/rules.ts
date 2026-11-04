// Regras puras da agenda de entrevistas. Fuso fixo America/Sao_Paulo via Intl
// (sem somar 3 h à mão). Sem banco, sem React.

import type { InterviewRow, InterviewStatus } from "./catalog";
import { roundShort } from "./catalog";

const TZ = "America/Sao_Paulo";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

interface Parts { y: number; mo: number; d: number; h: number; mi: number }

function brtParts(ms: number): Parts {
  const out: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return { y: out.year, mo: out.month, d: out.day, h: out.hour, mi: out.minute };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:mm" (hora de Brasília) → ISO UTC. */
export function brtLocalToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error("Data/hora inválida.");
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Corrige pelo deslocamento que o fuso mostra naquele instante (2 passadas estabilizam transições).
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = brtParts(guess);
    const shown = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    guess = asUtc - (shown - guess);
  }
  return new Date(guess).toISOString();
}

/** ISO UTC → "YYYY-MM-DDTHH:mm" em hora de Brasília. */
export function isoToBrtLocal(iso: string): string {
  const p = brtParts(new Date(iso).getTime());
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

function hourLabel(p: Parts): string {
  return p.mi === 0 ? `${p.h}h` : `${p.h}h${pad(p.mi)}`;
}

/** "12/11 · 14h" / "12/11 · 22h30". */
export function formatInterviewWhen(iso: string): string {
  const p = brtParts(new Date(iso).getTime());
  return `${pad(p.d)}/${pad(p.mo)} · ${hourLabel(p)}`;
}

type Timing = Pick<InterviewRow, "status" | "scheduledAt" | "durationMin">;

function endMs(i: Pick<InterviewRow, "scheduledAt" | "durationMin">): number {
  return new Date(i.scheduledAt).getTime() + i.durationMin * 60_000;
}

/** Agendada cujo horário (início + duração) já passou. */
export function isOverdue(i: Timing, now: Date): boolean {
  return i.status === "SCHEDULED" && endMs(i) < now.getTime();
}

/**
 * Entrevista que o card do pipeline destaca: a agendada futura mais próxima; sem futura,
 * a atrasada mais recente (pede desfecho). Canceladas/realizadas/faltas não contam.
 */
export function pickInterviewForCard<T extends Pick<InterviewRow, "status" | "scheduledAt" | "durationMin" | "round">>(
  list: T[],
  now: Date,
): { item: T; overdue: boolean } | null {
  const scheduled = list.filter((i) => i.status === "SCHEDULED");
  const upcoming = scheduled
    .filter((i) => !isOverdue(i, now))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  if (upcoming.length) return { item: upcoming[0], overdue: false };
  const late = scheduled
    .filter((i) => isOverdue(i, now))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  return late.length ? { item: late[0], overdue: true } : null;
}

/** "Entrevista G&G · hoje 14h" | "… · amanhã 9h" | "Entrevista Gestor · 20/11 10h". */
export function interviewSignalLabel(round: string, iso: string, now: Date): string {
  const t = brtParts(new Date(iso).getTime());
  const n = brtParts(now.getTime());
  const day = (p: Parts) => Date.UTC(p.y, p.mo - 1, p.d);
  const diff = Math.round((day(t) - day(n)) / 86_400_000);
  const when = diff === 0 ? "hoje" : diff === 1 ? "amanhã" : `${pad(t.d)}/${pad(t.mo)}`;
  return `Entrevista ${roundShort(round)} · ${when} ${hourLabel(t)}`;
}

/** Só uma agendada pode mudar de estado; os demais são finais. */
export function canTransition(from: InterviewStatus, to: InterviewStatus): boolean {
  return from === "SCHEDULED" && to !== "SCHEDULED";
}

/** Nome comparável: sem acento, minúsculo, espaços colapsados. */
export function normalizeInterviewer(name: string | null): string {
  if (!name) return "";
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Ids das entrevistas agendadas do MESMO entrevistador que se sobrepõem (só avisa, nunca bloqueia). */
export function findConflicts(
  candidate: { id?: string; interviewerName: string | null; scheduledAt: string; durationMin: number },
  others: Array<{ id: string; interviewerName: string | null; scheduledAt: string; durationMin: number; status: InterviewStatus }>,
): string[] {
  const who = normalizeInterviewer(candidate.interviewerName);
  if (!who) return [];
  const start = new Date(candidate.scheduledAt).getTime();
  const end = endMs(candidate);
  return others
    .filter((o) => {
      if (o.status !== "SCHEDULED" || o.id === candidate.id) return false;
      if (normalizeInterviewer(o.interviewerName) !== who) return false;
      return start < endMs(o) && new Date(o.scheduledAt).getTime() < end;
    })
    .map((o) => o.id);
}
