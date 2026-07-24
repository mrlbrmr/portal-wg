import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Máscara progressiva de celular: (xx) x xxxx-xxxx. Usada nos formulários. */
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  let out = "(" + d.slice(0, 2);
  if (d.length >= 2) out += ") ";
  if (d.length >= 3) out += d.slice(2, 3);
  if (d.length >= 4) out += " " + d.slice(3, 7);
  if (d.length >= 8) out += "-" + d.slice(7, 11);
  return out;
}

/** Normaliza texto para busca: minúsculas, sem acentos, sem espaços nas pontas. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativa",
  SCREENING: "Triagem",
  INTERVIEW: "Entrevistas",
  ADMISSION: "Admissão",
  PAUSED: "Pausada",
  CLOSED: "Cancelada",
  FILLED: "Finalizada",
};

// Status em que a vaga fica VISÍVEL no portal público (e aceitando inscrições).
// Triagem/Entrevistas/Admissão são etapas internas mas a vaga segue publicada;
// só sai do ar em Rascunho, Pausada e Cancelada.
export const PUBLIC_JOB_STATUSES = ["ACTIVE", "SCREENING", "INTERVIEW", "ADMISSION"] as const;

export function isPublicJobStatus(status: string): boolean {
  return (PUBLIC_JOB_STATUSES as readonly string[]).includes(status);
}

// Vaga "em andamento" no fluxo de recrutamento — usado nos filtros internos.
// Distinto de PUBLIC_JOB_STATUSES (visibilidade no portal): aqui Rascunho TAMBÉM
// conta como ativa, pois é uma vaga em preparação, ainda não encerrada.
export const ACTIVE_JOB_STATUSES = ["DRAFT", "ACTIVE", "SCREENING", "INTERVIEW", "ADMISSION"] as const;

export function isActiveJobStatus(status: string): boolean {
  return (ACTIVE_JOB_STATUSES as readonly string[]).includes(status);
}

// Status terminais (vaga encerrada): Cancelada e Finalizada. Ocultadas por
// padrão na lista interna de vagas.
export const TERMINAL_JOB_STATUSES = ["CLOSED", "FILLED"] as const;

export function isTerminalJobStatus(status: string): boolean {
  return (TERMINAL_JOB_STATUSES as readonly string[]).includes(status);
}

// Valor sentinela do filtro de status que representa "todas as ativas" (as 5
// etapas de ACTIVE_JOB_STATUSES). Não colide com os valores reais do enum.
export const ACTIVE_STATUS_FILTER = "ATIVAS";

// Etapas do funil de candidatura (colunas do Kanban de candidatos)
export const APPLICATION_STAGE_LABELS: Record<string, string> = {
  NEW: "Novo",
  SCREENING: "Triagem",
  INTERVIEW: "Entrevista",
  OFFER: "Proposta",
  HIRED: "Contratado",
  REJECTED: "Reprovado",
};

export const APPLICATION_STAGE_BADGE: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  SCREENING: "bg-amber-100 text-amber-700",
  INTERVIEW: "bg-purple-100 text-purple-700",
  OFFER: "bg-cyan-100 text-cyan-700",
  HIRED: "bg-wg-green/15 text-wg-green-dark",
  REJECTED: "bg-red-100 text-red-700",
};

export const MODALITY_LABELS: Record<string, string> = {
  PRESENTIAL: "Presencial",
  REMOTE: "Remoto",
  HYBRID: "Híbrido",
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CLT: "CLT",
  PJ: "PJ",
  INTERNSHIP: "Estágio",
  APPRENTICE: "Jovem Aprendiz",
  TEMPORARY: "Temporário",
  OTHER: "Outro",
};

export const JOB_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

// Ordem crescente de prioridade (para ordenação "maior prioridade")
export const JOB_PRIORITY_ORDER: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};

// Cores do badge de prioridade (tema claro do admin)
export const JOB_PRIORITY_BADGE: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-gray-100 text-gray-500",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

/** Dias inteiros decorridos desde a data informada (nunca negativo). */
export function daysSince(date: Date | string): number {
  const diff = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/** Rótulo relativo curto de idade: "hoje", "há 3 dias", "há 2 meses". */
export function formatAge(date: Date | string): string {
  const d = daysSince(date);
  if (d === 0) return "hoje";
  if (d === 1) return "há 1 dia";
  if (d < 30) return `há ${d} dias`;
  const months = Math.round(d / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

// A partir de quantos dias uma vaga aberta é considerada "parada" (destaque).
export const STALE_JOB_DAYS = 30;

export function generateSlug(title: string, city: string | null): string {
  const accentMap: Record<string, string> = {
    "á":"a","à":"a","ã":"a","â":"a","ä":"a",
    "é":"e","è":"e","ê":"e","ë":"e",
    "í":"i","ì":"i","î":"i","ï":"i",
    "ó":"o","ò":"o","õ":"o","ô":"o","ö":"o",
    "ú":"u","ù":"u","û":"u","ü":"u",
    "ç":"c","ñ":"n",
  };
  return (city ? `${title} ${city}` : title)
    .toLowerCase()
    .replace(/[áàãâäéèêëíìîïóòõôöúùûüçñ]/g, (c) => accentMap[c] ?? c)
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];
