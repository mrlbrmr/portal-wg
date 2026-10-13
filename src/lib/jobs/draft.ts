// Rascunho do formulário da vaga — módulo PURO (client-safe, testável).
//
// Compartilhado por "Nova vaga" (/vagas/nova) e pela página da vaga (/vagas/[id]/editar,
// onde também é completada a vaga que nasceu de uma solicitação). O corpo do POST/PATCH sai
// sempre de `draftToPayload` — que NUNCA leva `requestId`: o vínculo Solicitação ↔ Vaga é
// gravado só por create_job_from_request() no banco e nenhuma edição o toca.

import type { Job, JobVisibility } from "@/types/domain";
import { buildInitialContent, markdownToHtml } from "./markdown";
import { salaryStateFromJob, type SalaryMode } from "./salary";
import { dateInputValue } from "./deadlines";

export interface JobDraft {
  title: string;
  isTalentPool: boolean;
  department: string;
  company: string;
  city: string;
  state: string;
  contractType: string;
  workSchedule: string;
  openingReason: string;
  salaryMode: SalaryMode;
  /** Dígitos do valor em centavos ("280000" = R$ 2.800,00). */
  salaryDigits: string;
  salaryPublic: boolean;
  /** Texto salarial antigo sem valor numérico (só leitura; preservado se nada for informado). */
  salaryLegacyText: string | null;
  status: string;
  /** Publicação: Não publicar, Portal, Intranet ou os dois. */
  visibility: JobVisibility;
  responsible: string;
  hiringManager: string;
  closingDate: string;
  hiringDeadline: string;
  content: string;
  /** Modelo de vaga aplicado (procedência). O conteúdo é copiado — sem vínculo vivo. */
  templateId: string | null;
}

/** Valores com que "Nova vaga" começa nos selects — contam como "não preenchido" para o modelo. */
export const NEW_JOB_DEFAULTS = { contractType: "CLT" } as const;

/** Rascunho inicial: da vaga existente, ou vazio para "Nova vaga". */
export function jobToDraft(job: Job | null | undefined, defaults: { responsible?: string | null } = {}): JobDraft {
  const salary = job ? salaryStateFromJob(job) : null;
  return {
    title: job?.title ?? "",
    isTalentPool: job?.isTalentPool ?? false,
    department: job?.department ?? "",
    company: job?.company ?? "",
    city: job?.city ?? "",
    state: job?.state ?? (job ? "" : "SP"),
    contractType: job?.contractType ?? NEW_JOB_DEFAULTS.contractType,
    workSchedule: job?.workSchedule ?? "",
    openingReason: job?.openingReason ?? "",
    salaryMode: salary?.mode ?? "DEFINED",
    salaryDigits: salary?.salary != null ? String(Math.round(salary.salary * 100)) : "",
    salaryPublic: salary?.salaryPublic ?? true,
    salaryLegacyText: salary?.legacyText ?? null,
    status: job?.status ?? "DRAFT",
    visibility: job?.visibility ?? "BOTH",
    responsible: job?.responsible ?? defaults.responsible ?? "",
    hiringManager: job?.hiringManager ?? "",
    closingDate: dateInputValue(job?.closingDate as string | Date | null | undefined),
    hiringDeadline: dateInputValue(job?.hiringDeadline as string | Date | null | undefined),
    content: buildInitialContent(job ?? undefined),
    templateId: job?.templateId ?? null,
  };
}

export function salaryValue(d: Pick<JobDraft, "salaryDigits">): number | null {
  return d.salaryDigits ? parseInt(d.salaryDigits, 10) / 100 : null;
}

/** Corpo do POST/PATCH a partir do rascunho (mesmo formato nas duas rotas). */
export function draftToPayload(d: JobDraft) {
  return {
    title: d.title.trim(),
    department: d.department.trim() || null,
    company: d.company.trim() || null,
    isTalentPool: d.isTalentPool,
    city: d.isTalentPool ? null : d.city.trim(),
    state: d.isTalentPool ? null : d.state,
    contractType: d.contractType,
    description: markdownToHtml(d.content),
    responsibilities: null,
    requiredRequirements: null,
    desiredRequirements: null,
    benefits: null,
    workSchedule: d.workSchedule.trim() || null,
    salaryMode: d.salaryMode,
    salary: d.salaryMode === "DEFINED" ? salaryValue(d) : null,
    salaryPublic: d.salaryPublic,
    closingDate: d.closingDate || null,
    hiringDeadline: d.hiringDeadline || null,
    responsible: d.responsible.trim() || null,
    hiringManager: d.hiringManager.trim() || null,
    openingReason: d.openingReason || null,
    status: d.status,
    visibility: d.visibility,
    templateId: d.templateId,
  };
}

/** Validação mínima antes de enviar (o servidor valida de novo). */
export function validateDraft(d: JobDraft): string | null {
  if (d.title.trim().length < 2) return "Informe o título da vaga.";
  if (!d.isTalentPool && d.city.trim().length < 2) return "Informe a cidade da vaga.";
  if (!d.isTalentPool && !d.state) return "Informe a UF da vaga.";
  if (d.content.trim().length < 10) return 'O "Conteúdo da vaga" é obrigatório (mínimo 10 caracteres).';
  if (d.salaryMode === "DEFINED" && d.salaryDigits && salaryValue(d) === 0) return "Informe um salário maior que zero.";
  return null;
}
