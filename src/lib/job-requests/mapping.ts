// Tradução entre o formulário do gestor (form_data, keys livres) e os campos
// estruturados da requisição / da vaga. Fonte única de verdade do mapeamento —
// usada tanto no POST público quanto no pré-preenchimento do JobForm.
//
// Client-safe (sem acesso a banco): o JobForm importa daqui.

import type { ContractType } from "@/types/domain";

/** Keys reconhecidas do formulário padrão. Campos extras seguem em form_data. */
export const REQUEST_FIELD_KEYS = {
  gestor: "gestor",
  emailGestor: "emailGestor",
  funcao: "funcao",
  quantidade: "quantidade",
  tipoContratacao: "tipoContratacao",
  horario: "horario",
  local: "local",
  motivo: "motivo",
  colaboradorSubstituido: "colaboradorSubstituido",
  dataDesligamento: "dataDesligamento",
  dataInicio: "dataInicio",
  salarioPretendido: "salarioPretendido",
  perfil: "perfil",
  observacoes: "observacoes",
} as const;

const CONTRACT_TYPE_BY_LABEL: Record<string, ContractType> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "INTERNSHIP",
  "estágio": "INTERNSHIP",
  estagiario: "INTERNSHIP",
  "jovem aprendiz": "APPRENTICE",
  aprendiz: "APPRENTICE",
  temporario: "TEMPORARY",
  "temporário": "TEMPORARY",
};

export function parseContractType(raw: string | undefined | null): ContractType {
  if (!raw) return "CLT";
  const key = raw.trim().toLowerCase();
  return CONTRACT_TYPE_BY_LABEL[key] ?? "OTHER";
}

/** Converte "3", "3 posições" → 3. Retorna null quando não houver número. */
export function parseOpenings(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const match = raw.match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Normaliza data vinda de <input type="date"> (YYYY-MM-DD). Inválida → null. */
export function parseIsoDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export interface RequestCoreFields {
  title: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  reason: string | null;
  location: string | null;
  openings: number | null;
  desiredStartDate: string | null;
}

/** Extrai do form_data as colunas derivadas da requisição. */
export function extractRequestFields(formData: Record<string, string>): RequestCoreFields {
  const get = (key: string) => (formData[key] ?? "").trim() || null;
  return {
    title: get(REQUEST_FIELD_KEYS.funcao),
    requesterName: get(REQUEST_FIELD_KEYS.gestor),
    requesterEmail: get(REQUEST_FIELD_KEYS.emailGestor),
    reason: get(REQUEST_FIELD_KEYS.motivo),
    location: get(REQUEST_FIELD_KEYS.local),
    openings: parseOpenings(formData[REQUEST_FIELD_KEYS.quantidade]),
    desiredStartDate: parseIsoDate(formData[REQUEST_FIELD_KEYS.dataInicio]),
  };
}

/**
 * Monta o conteúdo Markdown inicial da vaga a partir do que o gestor escreveu.
 * O RH completa/reescreve no editor antes de publicar — aqui é só o ponto de partida.
 */
export function buildJobMarkdown(formData: Record<string, string>): string {
  const perfil = (formData[REQUEST_FIELD_KEYS.perfil] ?? "").trim();
  const observacoes = (formData[REQUEST_FIELD_KEYS.observacoes] ?? "").trim();

  const sections: string[] = [];
  sections.push("### Responsabilidades\n\n");
  if (perfil) {
    sections.push(`### Perfil do candidato\n\n${perfil}`);
  } else {
    sections.push("### Requisitos\n\n");
  }
  sections.push("### Benefícios\n\n");
  if (observacoes) {
    sections.push(`### Outras informações\n\n${observacoes}`);
  }
  return sections.join("\n\n");
}

export interface JobDraftFromRequest {
  title: string;
  workSchedule: string | null;
  company: string | null;
  openings: number | null;
  contractType: ContractType;
  salaryRange: string | null;
  hiringManager: string | null;
  hiringDeadline: string | null;
  markdown: string;
}

/** Valores com que o JobForm abre quando o RH aprova uma requisição. */
export function buildJobDraftFromRequest(
  formData: Record<string, string>
): JobDraftFromRequest {
  const core = extractRequestFields(formData);
  const salario = (formData[REQUEST_FIELD_KEYS.salarioPretendido] ?? "").trim();
  return {
    title: core.title ?? "",
    workSchedule: (formData[REQUEST_FIELD_KEYS.horario] ?? "").trim() || null,
    company: core.location,
    openings: core.openings,
    contractType: parseContractType(formData[REQUEST_FIELD_KEYS.tipoContratacao]),
    salaryRange: salario || null,
    hiringManager: core.requesterName,
    hiringDeadline: core.desiredStartDate,
    markdown: buildJobMarkdown(formData),
  };
}
