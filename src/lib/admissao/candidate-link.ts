// Vínculo admissão ↔ candidatura do processo seletivo — módulo PURO (sem banco, sem sessão).
//
// Uma admissão cadastrada direto em Admissões não sabe de qual processo seletivo a pessoa
// veio. Vincular grava admissions."sourceApplicationId"/"sourceJobId" (as MESMAS colunas do
// "Contratar" do pipeline): a pessoa passa a ser uma só — o pipeline mostra a admissão, o
// Banco de Talentos a conta como contratada, a posição da vaga sabe quem a ocupa.
//
// Aqui ficam as regras que a tela e a server action consultam juntas:
//   • sugestões: por que esta candidatura parece ser a mesma pessoa (CPF, e-mail, telefone, nome);
//   • bloqueio: candidatura já ligada a OUTRA admissão nunca é vinculada de novo;
//   • unificação: só COMPLETA dados vazios da admissão — nunca sobrescreve o que o RH gravou;
//   • etapa: para onde o candidato vai no funil (Admissão/Contratado), só se ainda não está lá.

import { normalizeText } from "@/lib/utils";

export type MatchReason = "CPF" | "EMAIL" | "PHONE" | "NAME" | "NAME_PARTIAL";

export const MATCH_REASON_LABELS: Record<MatchReason, string> = {
  CPF: "Mesmo CPF",
  EMAIL: "Mesmo e-mail",
  PHONE: "Mesmo telefone",
  NAME: "Mesmo nome",
  NAME_PARTIAL: "Nome parecido",
};

const REASON_WEIGHT: Record<MatchReason, number> = { CPF: 100, EMAIL: 60, PHONE: 40, NAME: 30, NAME_PARTIAL: 10 };

/** Dados da admissão usados para reconhecer a mesma pessoa. */
export interface PersonKeys {
  fullName: string | null;
  cpf: string | null;
  email: string | null;
  phone: string | null;
}

export const digitsOnly = (v: string | null | undefined): string => (v ?? "").replace(/\D/g, "");

export function normalizeCpf(v: string | null | undefined): string | null {
  const d = digitsOnly(v);
  return d.length === 11 ? d : null;
}

/** CPF para conferência na tela sem expor o número inteiro: ***.456.789-** */
export function maskCpf(v: string | null | undefined): string | null {
  const d = normalizeCpf(v);
  return d ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : null;
}

export function normalizeEmail(v: string | null | undefined): string | null {
  const e = (v ?? "").trim().toLowerCase();
  return e.includes("@") ? e : null;
}

/** Telefone sem DDI 55 e sem formatação; só compara a partir de 10 dígitos (DDD + número). */
export function normalizePhone(v: string | null | undefined): string | null {
  let d = digitsOnly(v);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? d : null;
}

export function nameTokens(v: string | null | undefined): string[] {
  return normalizeText(v ?? "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Primeiro e último nome — base da busca por nome parecido (ignora nomes do meio). */
export function firstLastName(v: string | null | undefined): { first: string; last: string } | null {
  const t = nameTokens(v);
  if (t.length < 2) return null;
  return { first: t[0], last: t[t.length - 1] };
}

/**
 * Padrão ilike que ignora acentos sem unaccent no banco: vogais e "c" viram o curinga de
 * UM caractere ("antonio" casa "Antônio" e vice-versa). Só amplia a busca no banco — quem
 * decide se é sugestão é matchReasons().
 */
export function accentInsensitivePattern(token: string): string {
  return normalizeText(token).replace(/[^a-z]/g, "").replace(/[aeiouc]/g, "_");
}

/** Por que a candidatura parece ser a mesma pessoa da admissão (mais forte primeiro). */
export function matchReasons(admission: PersonKeys, candidate: PersonKeys): MatchReason[] {
  const reasons: MatchReason[] = [];
  const cpf = normalizeCpf(admission.cpf);
  if (cpf && cpf === normalizeCpf(candidate.cpf)) reasons.push("CPF");
  const email = normalizeEmail(admission.email);
  if (email && email === normalizeEmail(candidate.email)) reasons.push("EMAIL");
  const phone = normalizePhone(admission.phone);
  if (phone && phone === normalizePhone(candidate.phone)) reasons.push("PHONE");
  // Só o primeiro nome ("Maria") não identifica ninguém: nome exige ao menos dois termos.
  const ta = nameTokens(admission.fullName);
  const a = ta.join(" ");
  if (ta.length >= 2 && a === nameTokens(candidate.fullName).join(" ")) reasons.push("NAME");
  else {
    const fa = firstLastName(admission.fullName);
    const fc = firstLastName(candidate.fullName);
    if (fa && fc && fa.first === fc.first && fa.last === fc.last) reasons.push("NAME_PARTIAL");
  }
  return reasons;
}

export function matchScore(reasons: MatchReason[]): number {
  return reasons.reduce((s, r) => s + REASON_WEIGHT[r], 0);
}

/**
 * Ordena para o RH: primeiro quem mais parece ser a mesma pessoa; empate → candidatura em
 * processo (não reprovada) e mais recente. Sem nenhum motivo = resultado só da busca.
 */
export function rankCandidates<T extends PersonKeys & { createdAt: string; stageKind: string | null }>(
  admission: PersonKeys,
  list: T[]
): Array<T & { reasons: MatchReason[] }> {
  return list
    .map((c) => ({ ...c, reasons: matchReasons(admission, c) }))
    .sort((x, y) => {
      const s = matchScore(y.reasons) - matchScore(x.reasons);
      if (s !== 0) return s;
      const lost = Number(x.stageKind === "LOST") - Number(y.stageKind === "LOST");
      if (lost !== 0) return lost;
      return new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime();
    });
}

/** Admissão (não excluída) já ligada à candidatura, se houver. */
export interface LinkedAdmission {
  id: string;
  fullName: string;
}

/** Motivo para NÃO vincular (null = pode). */
export function linkBlocker(admissionId: string, linked: LinkedAdmission | null): string | null {
  if (!linked || linked.id === admissionId) return null;
  return `Já vinculada à admissão de ${linked.fullName}.`;
}

/** Campos da admissão que o vínculo pode completar a partir da candidatura. */
export type FillableField = "cpf" | "email" | "phone";

export const FILLABLE_LABELS: Record<FillableField, string> = { cpf: "CPF", email: "E-mail", phone: "Telefone" };

/**
 * Unificação dos cadastros: copia da candidatura só o que está VAZIO na admissão.
 * CPF só vai se for válido em tamanho (11 dígitos); o que o RH já gravou nunca muda.
 */
export function blankFieldsFromCandidate(
  admission: Pick<PersonKeys, "cpf" | "email" | "phone">,
  candidate: Pick<PersonKeys, "cpf" | "email" | "phone">
): Partial<Record<FillableField, string>> {
  const out: Partial<Record<FillableField, string>> = {};
  const blank = (v: string | null) => !v || !v.trim();
  if (blank(admission.cpf) && normalizeCpf(candidate.cpf)) out.cpf = candidate.cpf!.trim();
  if (blank(admission.email) && normalizeEmail(candidate.email)) out.email = candidate.email!.trim().toLowerCase();
  if (blank(admission.phone) && candidate.phone?.trim()) out.phone = candidate.phone.trim();
  return out;
}

// ─── Etapa do funil ──────────────────────────────────────────────────────────────────

export interface LinkStage {
  id: string;
  name: string;
  kind: string;
  sortOrder: number;
  active: boolean;
}

/** Etapas para onde o candidato contratado pode ir: tipo Admissão ou Contratado, ativas. */
export function hiringStages(stages: LinkStage[]): LinkStage[] {
  return stages
    .filter((s) => s.active && (s.kind === "ADMISSION" || s.kind === "WON"))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Etapa sugerida ao vincular: null quando o candidato JÁ está numa etapa de contratação
 * (não mexe no funil); senão a primeira etapa de Admissão (ou Contratado, se não houver).
 */
export function suggestedHiringStage(currentKind: string | null, stages: LinkStage[]): string | null {
  if (currentKind === "ADMISSION" || currentKind === "WON") return null;
  const options = hiringStages(stages);
  return (options.find((s) => s.kind === "ADMISSION") ?? options[0])?.id ?? null;
}

// ─── Posição da vaga ─────────────────────────────────────────────────────────────────

export interface LinkPosition {
  id: string;
  positionNumber: number;
  status: string;
  applicationId: string | null;
  admissionId: string | null;
}

export type PositionPlan =
  /** A candidatura já ocupa uma posição: a admissão é ligada a ela. */
  | { kind: "occupied"; positionId: string; positionNumber: number; hasOtherAdmission: boolean }
  /** Há posições em aberto: o RH escolhe uma (ou nenhuma). */
  | { kind: "open"; options: Array<{ id: string; positionNumber: number }> }
  /** Vaga sem posição em aberto (ou banco de talentos): nada a fazer. */
  | { kind: "none" };

export function positionPlan(applicationId: string, admissionId: string, positions: LinkPosition[]): PositionPlan {
  const mine = positions.find((p) => p.status === "FILLED" && p.applicationId === applicationId);
  if (mine) {
    return {
      kind: "occupied",
      positionId: mine.id,
      positionNumber: mine.positionNumber,
      hasOtherAdmission: !!mine.admissionId && mine.admissionId !== admissionId,
    };
  }
  const open = positions
    .filter((p) => p.status === "OPEN")
    .sort((a, b) => a.positionNumber - b.positionNumber)
    .map((p) => ({ id: p.id, positionNumber: p.positionNumber }));
  return open.length > 0 ? { kind: "open", options: open } : { kind: "none" };
}

// ─── Busca ───────────────────────────────────────────────────────────────────────────

/**
 * Termo seguro para o filtro `or()` do PostgREST: sem vírgula, parênteses, curingas nem
 * aspas (que quebrariam a expressão). Vazio = sem busca.
 */
export function sanitizeSearch(q: string | null | undefined): string {
  return (q ?? "").replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
