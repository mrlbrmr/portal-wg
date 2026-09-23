// Prazos da vaga — módulo PURO.
//
// Dois prazos diferentes, que o formulário antigo deixava ambíguos:
//   • closingDate    = Encerramento das INSCRIÇÕES (depois dele o portal e a API recusam
//                      novas candidaturas);
//   • hiringDeadline = Contratação prevista até (meta interna para preencher as posições).
// As datas são "só dia": a contagem usa o calendário de São Paulo, não horas corridas.

import type { Tone } from "@/components/ui/StatusBadge";

const TZ = "America/Sao_Paulo";

/** AAAA-MM-DD do instante no fuso de São Paulo. */
export function dayKeySP(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/**
 * AAAA-MM-DD de uma data gravada. Datas só-dia são salvas como meia-noite UTC
 * ("2026-09-30T00:00:00Z"); convertê-las para o fuso de SP daria o dia anterior. Por isso
 * a parte de data do ISO é usada direto.
 */
export function storedDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Dias do calendário de hoje até a data (negativo = já passou). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return dayNumber(storedDayKey(iso)) - dayNumber(dayKeySP(now));
}

export interface DeadlineView {
  days: number;
  label: string;
  tone: Tone;
}

/** "22 dias restantes" · "Vence hoje" · "Prazo vencido há 3 dias" */
export function deadlineView(iso: string | null | undefined, now: Date = new Date()): DeadlineView | null {
  if (!iso) return null;
  const days = daysUntil(iso, now);
  if (days > 1) return { days, label: `${days} dias restantes`, tone: days <= 7 ? "warning" : "neutral" };
  if (days === 1) return { days, label: "Vence amanhã", tone: "warning" };
  if (days === 0) return { days, label: "Vence hoje", tone: "warning" };
  const over = -days;
  return { days, label: `Prazo vencido há ${over} ${over === 1 ? "dia" : "dias"}`, tone: "danger" };
}

/** "30/09/2026" a partir de uma data gravada (sem deslocar o dia pelo fuso). */
export function formatStoredDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = storedDayKey(iso).split("-");
  return `${d}/${m}/${y}`;
}

/** Valor para <input type="date">. */
export function dateInputValue(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  return typeof iso === "string" ? storedDayKey(iso) : iso.toISOString().slice(0, 10);
}
