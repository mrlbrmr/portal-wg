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

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Recebido",
  HR_REVIEW: "Em análise RH",
  SELECTED_INTERVIEW: "Selecionado para entrevista",
  INTERVIEW_SCHEDULED: "Entrevista agendada",
  INTERVIEWED: "Entrevistado",
  SENT_TO_MANAGER: "Enviado ao gestor",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  NO_SHOW: "Não compareceu",
  TALENT_POOL: "Banco de talentos",
};

export const APPLICATION_STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-800",
  HR_REVIEW: "bg-yellow-100 text-yellow-800",
  SELECTED_INTERVIEW: "bg-purple-100 text-purple-800",
  INTERVIEW_SCHEDULED: "bg-indigo-100 text-indigo-800",
  INTERVIEWED: "bg-orange-100 text-orange-800",
  SENT_TO_MANAGER: "bg-cyan-100 text-cyan-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  NO_SHOW: "bg-gray-100 text-gray-800",
  TALENT_POOL: "bg-teal-100 text-teal-800",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CLOSED: "Encerrada",
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

export const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];
