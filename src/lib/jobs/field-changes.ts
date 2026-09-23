// Alterações relevantes de campos da vaga — módulo PURO.
//
// O PATCH da vaga compara o antes e o depois e grava UM evento FIELDS_UPDATED em
// job_events com a lista do que mudou (valor anterior → novo). A mudança de STATUS não
// entra aqui: ela já é registrada em job_status_history.

import { CONTRACT_TYPE_LABELS, MODALITY_LABELS } from "@/lib/utils";
import { JOB_REQUEST_REASON_LABELS } from "@/lib/job-requests/constants";
import { formatBRL } from "./salary";
import { formatStoredDate } from "./deadlines";

export type TrackedField =
  | "title"
  | "isTalentPool"
  | "department"
  | "company"
  | "city"
  | "state"
  | "modality"
  | "contractType"
  | "workSchedule"
  | "openingReason"
  | "salary"
  | "salaryRange"
  | "salaryPublic"
  | "responsible"
  | "hiringManager"
  | "closingDate"
  | "hiringDeadline"
  | "description";

export const TRACKED_FIELD_LABELS: Record<TrackedField, string> = {
  title: "Título",
  isTalentPool: "Tipo de oportunidade",
  department: "Área / departamento",
  company: "Empresa / unidade",
  city: "Cidade",
  state: "UF",
  modality: "Modalidade",
  contractType: "Tipo de contratação",
  workSchedule: "Horário",
  openingReason: "Motivo da abertura",
  salary: "Salário",
  salaryRange: "Salário no portal",
  salaryPublic: "Divulgação do salário",
  responsible: "Recrutador responsável",
  hiringManager: "Gestor solicitante",
  closingDate: "Encerramento das inscrições",
  hiringDeadline: "Contratação prevista",
  description: "Descrição da vaga",
};

export interface FieldChange {
  field: TrackedField;
  label: string;
  /** Texto legível; null = vazio. A descrição não guarda valores (texto longo). */
  from: string | null;
  to: string | null;
}

function display(field: TrackedField, v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  switch (field) {
    case "isTalentPool":
      return v ? "Banco de talentos" : "Vaga específica";
    case "modality":
      return MODALITY_LABELS[String(v)] ?? String(v);
    case "contractType":
      return CONTRACT_TYPE_LABELS[String(v)] ?? String(v);
    case "openingReason":
      return JOB_REQUEST_REASON_LABELS[v as keyof typeof JOB_REQUEST_REASON_LABELS] ?? String(v);
    case "salary":
      return formatBRL(Number(v));
    case "salaryPublic":
      return v ? "Divulgado no portal" : "Não divulgado";
    case "closingDate":
    case "hiringDeadline":
      return formatStoredDate(String(v));
    default:
      return String(v);
  }
}

function comparable(field: TrackedField, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (field === "salary") return Number(v).toFixed(2);
  if (field === "closingDate" || field === "hiringDeadline") return String(v).slice(0, 10);
  if (field === "salaryPublic" || field === "isTalentPool") return v ? "1" : "0";
  return String(v).trim();
}

/**
 * Compara só os campos presentes em `after` (o que o PATCH enviou). Devolve a lista
 * pronta para o histórico.
 */
export function diffJobFields(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const out: FieldChange[] = [];
  for (const field of Object.keys(TRACKED_FIELD_LABELS) as TrackedField[]) {
    if (!(field in after)) continue;
    if (comparable(field, before[field]) === comparable(field, after[field])) continue;
    if (field === "description") {
      out.push({ field, label: TRACKED_FIELD_LABELS[field], from: null, to: null });
      continue;
    }
    out.push({ field, label: TRACKED_FIELD_LABELS[field], from: display(field, before[field]), to: display(field, after[field]) });
  }
  return out;
}
