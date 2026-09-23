// Escopo APROVADO × configuração ATUAL da vaga — módulo PURO.
//
// jobs.approvedScope é o snapshot gravado por create_job_from_request() no momento em que
// a solicitação virou vaga (ou pela migração, para vagas antigas). A solicitação pode ser
// reeditada depois; o snapshot não. Aqui comparamos os dois para:
//   • marcar no formulário os campos que fazem parte do escopo aprovado;
//   • avisar antes de salvar uma alteração de escopo;
//   • mostrar discretamente "Originalmente aprovado: X" quando houver divergência.

import { CONTRACT_TYPE_LABELS, MODALITY_LABELS } from "@/lib/utils";
import { JOB_REQUEST_REASON_LABELS } from "@/lib/job-requests/constants";
import { formatBRL } from "./salary";

export interface ApprovedScope {
  requestCode?: string | null;
  title?: string | null;
  department?: string | null;
  location?: string | null;
  openings?: number | null;
  contractType?: string | null;
  modality?: string | null;
  workSchedule?: string | null;
  reasonType?: string | null;
  requesterName?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  desiredStartDate?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  capturedAt?: string | null;
  capturedBy?: string | null;
}

/** Campos da vaga que podem divergir do escopo aprovado. */
export type ScopeField =
  | "title"
  | "department"
  | "company"
  | "openings"
  | "contractType"
  | "modality"
  | "openingReason"
  | "hiringManager"
  | "salary";

export const SCOPE_FIELD_LABELS: Record<ScopeField, string> = {
  title: "Cargo / título",
  department: "Área / departamento",
  company: "Empresa / unidade",
  openings: "Número de posições",
  contractType: "Tipo de contratação",
  modality: "Modalidade",
  openingReason: "Motivo da abertura",
  hiringManager: "Gestor solicitante",
  salary: "Salário",
};

/** Valores atuais da vaga relevantes para o escopo. */
export interface ScopeCurrent {
  title: string | null;
  department: string | null;
  company: string | null;
  /** Posições ativas. */
  openings: number | null;
  contractType: string | null;
  modality: string | null;
  openingReason: string | null;
  hiringManager: string | null;
  salary: number | null;
}

export interface ScopeDivergence {
  field: ScopeField;
  label: string;
  approved: string;
  current: string;
}

function norm(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().toLocaleLowerCase("pt-BR");
}

function display(field: ScopeField, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (field === "contractType") return CONTRACT_TYPE_LABELS[String(v)] ?? String(v);
  if (field === "modality") return MODALITY_LABELS[String(v)] ?? String(v);
  if (field === "openingReason") return JOB_REQUEST_REASON_LABELS[v as keyof typeof JOB_REQUEST_REASON_LABELS] ?? String(v);
  if (field === "openings") return `${v} ${Number(v) === 1 ? "posição" : "posições"}`;
  return String(v);
}

/** Valor aprovado de cada campo (null = a solicitação não definiu). */
export function approvedValue(scope: ApprovedScope, field: ScopeField): unknown {
  switch (field) {
    case "title":
      return scope.title ?? null;
    case "department":
      return scope.department ?? null;
    case "company":
      return scope.location ?? null;
    case "openings":
      return scope.openings ?? null;
    case "contractType":
      return scope.contractType ?? null;
    case "modality":
      return scope.modality ?? null;
    case "openingReason":
      return scope.reasonType ?? null;
    case "hiringManager":
      return scope.requesterName ?? null;
    case "salary":
      return null; // tratado à parte (faixa)
  }
}

function salaryApprovedLabel(scope: ApprovedScope): string | null {
  const { salaryMin: min, salaryMax: max } = scope;
  if (min != null && max != null && max > min) return `${formatBRL(min)} – ${formatBRL(max)}`;
  if (min != null) return `A partir de ${formatBRL(min)}`;
  if (max != null) return `Até ${formatBRL(max)}`;
  return null;
}

/** Campos que a solicitação aprovou (e que, portanto, são marcados no formulário). */
export function approvedFields(scope: ApprovedScope | null | undefined): Set<ScopeField> {
  const out = new Set<ScopeField>();
  if (!scope) return out;
  for (const f of Object.keys(SCOPE_FIELD_LABELS) as ScopeField[]) {
    if (f === "salary") {
      if (salaryApprovedLabel(scope)) out.add(f);
    } else if (norm(approvedValue(scope, f)) !== "") out.add(f);
  }
  return out;
}

/** Divergências entre o aprovado e o atual. Campos que a solicitação não definiu não contam. */
export function scopeDivergences(scope: ApprovedScope | null | undefined, current: ScopeCurrent): ScopeDivergence[] {
  if (!scope) return [];
  const out: ScopeDivergence[] = [];
  for (const field of approvedFields(scope)) {
    if (field === "salary") {
      const min = scope.salaryMin ?? null;
      const max = scope.salaryMax ?? null;
      const s = current.salary;
      const outside = s == null || (min != null && s < min) || (max != null && s > max);
      if (outside) {
        out.push({
          field,
          label: SCOPE_FIELD_LABELS.salary,
          approved: salaryApprovedLabel(scope) ?? "—",
          current: s == null ? "Não definido" : formatBRL(s),
        });
      }
      continue;
    }
    const approved = approvedValue(scope, field);
    const now = current[field];
    if (norm(approved) !== norm(now)) {
      out.push({ field, label: SCOPE_FIELD_LABELS[field], approved: display(field, approved), current: display(field, now) });
    }
  }
  return out;
}

/** Texto discreto sob o campo: "Originalmente aprovado: 2 posições". */
export function approvedHint(scope: ApprovedScope | null | undefined, field: ScopeField, current: unknown): string | null {
  if (!scope) return null;
  if (field === "salary") return null;
  const approved = approvedValue(scope, field);
  if (norm(approved) === "" || norm(approved) === norm(current)) return null;
  return `Originalmente aprovado: ${display(field, approved)}`;
}

/** Quais campos de escopo uma edição está prestes a mudar (para o aviso antes de salvar). */
export function scopeFieldsBeingChanged(
  scope: ApprovedScope | null | undefined,
  before: Partial<ScopeCurrent>,
  after: Partial<ScopeCurrent>
): ScopeField[] {
  const marked = approvedFields(scope);
  return (Object.keys(after) as (keyof ScopeCurrent)[]).filter(
    (f) => marked.has(f as ScopeField) && norm(before[f]) !== norm(after[f])
  ) as ScopeField[];
}
