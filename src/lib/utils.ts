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

export const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
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

export function generateSlug(title: string, city: string): string {
  const accentMap: Record<string, string> = {
    "á":"a","à":"a","ã":"a","â":"a","ä":"a",
    "é":"e","è":"e","ê":"e","ë":"e",
    "í":"i","ì":"i","î":"i","ï":"i",
    "ó":"o","ò":"o","õ":"o","ô":"o","ö":"o",
    "ú":"u","ù":"u","û":"u","ü":"u",
    "ç":"c","ñ":"n",
  };
  return `${title} ${city}`
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
