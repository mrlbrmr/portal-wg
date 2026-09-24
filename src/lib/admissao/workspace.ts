// Central da admissão (/admissoes/[id]) — módulo PURO (roda no servidor e no cliente).
//
//   • Progresso ........ derivado SÓ das etapas configuradas (admission_stages) + stageId.
//                        Não existe um segundo sistema de etapas.
//   • Pendências ....... derivadas de fatos gravados (datas, documentos, formulário, CPF).
//                        Sem problema real, nenhuma pendência aparece.
//   • Rascunho ......... valores editáveis da admissão como strings de formulário; o PATCH
//                        recebe o mesmo formato que o formulário antigo enviava.
//
// Testes: workspace.test.ts (npm test).

import { isValidCpf } from "@/lib/cpf";
import type { DigitalFormState } from "./overview";

// ─── Abas e seções ──────────────────────────────────────────────────────────────────────

export type AdmissionTab = "visao-geral" | "dados" | "contratacao" | "documentos" | "recursos" | "historico";

export const ADMISSION_TABS: Array<{ id: AdmissionTab; label: string }> = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "dados", label: "Dados pessoais" },
  { id: "contratacao", label: "Contratação" },
  { id: "documentos", label: "Documentos" },
  { id: "recursos", label: "Benefícios e recursos" },
  { id: "historico", label: "Histórico" },
];

export function parseAdmissionTab(raw: string | undefined | null): AdmissionTab {
  return ADMISSION_TABS.some((t) => t.id === raw) ? (raw as AdmissionTab) : "visao-geral";
}

/** Blocos editáveis da ficha. Cada um entra em modo edição de forma independente. */
export type AdmissionSection = "pessoais" | "contratacao" | "recursos" | "notas";

export const SECTION_TAB: Record<AdmissionSection, AdmissionTab> = {
  pessoais: "dados",
  contratacao: "contratacao",
  recursos: "recursos",
  notas: "visao-geral",
};

// ─── Datas ──────────────────────────────────────────────────────────────────────────────

/** "2026-09-28" (ou ISO completo) → "28/09/2026". Sem conversão de fuso: é data de calendário. */
export function formatDateBR(value: string | null | undefined): string | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo — calculada no servidor e repassada à tela. */
export function todayISOInSaoPaulo(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** "AAAA-MM-DD" → Date ao meio-dia local (evita virar o dia em qualquer fuso). */
export function todayFrom(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/** Dias corridos entre hoje e uma data "AAAA-MM-DD" (negativo = passou). */
export function daysFromToday(dateISO: string, today: Date = new Date()): number {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const target = new Date(`${dateISO.slice(0, 10)}T00:00:00`);
  return Math.round((target.getTime() - t.getTime()) / 86_400_000);
}

/** "Hoje", "Amanhã", "Em 3 dias", "Há 2 dias". */
export function relativeDaysLabel(days: number): string {
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days === -1) return "Ontem";
  return days > 0 ? `Em ${days} dias` : `Há ${-days} dias`;
}

// ─── Progresso (etapas configuradas) ────────────────────────────────────────────────────

export interface StageDef {
  id: string;
  name: string;
  color?: string | null;
  isFinal?: boolean | null;
}

export type StepState = "done" | "current" | "todo";

export interface AdmissionProgress {
  steps: Array<{ id: string; name: string; color: string | null; state: StepState }>;
  total: number;
  /** Etapas já concluídas (anteriores à atual; todas até a atual quando ela é a de conclusão). */
  completed: number;
  /** 0–100. */
  percent: number;
  /** Índice (0-based) da etapa atual na jornada; -1 = sem etapa ou etapa fora da jornada. */
  currentIndex: number;
  isComplete: boolean;
  /** Próxima etapa da jornada (para o atalho "Avançar"); null se concluída/última. */
  next: { id: string; name: string } | null;
}

export function admissionProgress(stages: StageDef[], currentStageId: string | null): AdmissionProgress {
  const idx = currentStageId ? stages.findIndex((s) => s.id === currentStageId) : -1;
  const isComplete = idx >= 0 && !!stages[idx].isFinal;
  const total = stages.length;
  const completed = idx < 0 ? 0 : isComplete ? idx + 1 : idx;
  const steps = stages.map((s, i) => ({
    id: s.id,
    name: s.name,
    color: s.color ?? null,
    state: (idx < 0 ? "todo" : i < idx || (isComplete && i === idx) ? "done" : i === idx ? "current" : "todo") as StepState,
  }));
  const nextStage = isComplete ? null : idx < 0 ? (stages[0] ?? null) : (stages[idx + 1] ?? null);
  return {
    steps,
    total,
    completed,
    percent: isComplete ? 100 : total > 0 ? Math.round((completed / total) * 100) : 0,
    currentIndex: idx,
    isComplete,
    next: nextStage ? { id: nextStage.id, name: nextStage.name } : null,
  };
}

// ─── Formulário em preenchimento ────────────────────────────────────────────────────────
// O candidato sobe cada documento na hora (rota de upload), mas as respostas só são
// gravadas no envio final — e é o envio final que avisa o RH por e-mail. Enquanto isso,
// os anexos enviados pelo link são o único sinal de que ele começou.
//
// Só os documentos obrigatórios SEMPRE visíveis entram na conta: os condicionais dependem
// de respostas (gênero, estado civil…) que ainda não existem no banco.

export interface FormFillProgress {
  /** Documentos obrigatórios sempre visíveis que o candidato já enviou. */
  requiredDone: number;
  requiredTotal: number;
  /** Rótulos dos obrigatórios sempre visíveis ainda sem arquivo. */
  missing: string[];
  /** Há obrigatórios que dependem das respostas — o total pode crescer no envio. */
  hasConditionalRequired: boolean;
  /** Arquivos enviados pelo candidato (qualquer documento). */
  uploads: number;
  lastUploadAt: string | null;
}

export interface FormFillInput {
  /** Documentos do formulário (admission_form_config). */
  documents: Array<{ label: string; required: boolean; condition: { type: string } }>;
  /** Cadastro "Tipos de documento" — o upload liga pelo nome exato do rótulo. */
  documentTypes: Array<{ id: string; name: string }>;
  /** Só os anexos enviados pelo candidato (sem usuário do RH). */
  candidateAttachments: Array<{ documentTypeId: string | null; createdAt: string }>;
}

/** Progresso do formulário ainda não enviado; null quando o candidato não subiu nada. */
export function formFillProgress({ documents, documentTypes, candidateAttachments }: FormFillInput): FormFillProgress | null {
  if (candidateAttachments.length === 0) return null;

  const typeIdByName = new Map(documentTypes.map((t) => [t.name, t.id]));
  const sentTypes = new Set(candidateAttachments.map((a) => a.documentTypeId).filter(Boolean));
  const required = documents.filter((d) => d.required && d.condition.type === "always");
  const missing = required
    .filter((d) => {
      const typeId = typeIdByName.get(d.label);
      return !typeId || !sentTypes.has(typeId);
    })
    .map((d) => d.label);

  const lastUploadAt = candidateAttachments.reduce<string | null>(
    (max, a) => (max === null || new Date(a.createdAt) > new Date(max) ? a.createdAt : max),
    null
  );

  return {
    requiredDone: required.length - missing.length,
    requiredTotal: required.length,
    missing,
    hasConditionalRequired: documents.some((d) => d.required && d.condition.type !== "always"),
    uploads: candidateAttachments.length,
    lastUploadAt,
  };
}

// ─── Pendências ─────────────────────────────────────────────────────────────────────────

export type PendencyTone = "danger" | "warning" | "info";

export interface Pendency {
  key: string;
  tone: PendencyTone;
  text: string;
  /** Aba onde o RH resolve a pendência. */
  tab?: AdmissionTab;
}

export interface PendencyInput {
  isFinal: boolean;
  hasStage: boolean;
  startDate: string | null; // AAAA-MM-DD
  medicalExamDate: string | null; // AAAA-MM-DD
  cpf: string | null;
  formState: DigitalFormState;
  /** Documentos já enviados pelo link, antes do envio final (formFillProgress). */
  formFill?: Pick<FormFillProgress, "requiredDone" | "requiredTotal"> | null;
  missingRequiredDocs: string[];
  docsToReview: string[];
  docsRejected: string[];
}

/** Janela (dias) em que o início próximo sem ASO vira alerta. */
export const EXAM_ALERT_WINDOW_DAYS = 7;

const TONE_ORDER: Record<PendencyTone, number> = { danger: 0, warning: 1, info: 2 };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function admissionPendencies(p: PendencyInput, today: Date = new Date()): Pendency[] {
  if (p.isFinal) return [];
  const out: Pendency[] = [];
  const startDays = p.startDate ? daysFromToday(p.startDate, today) : null;

  if (startDays !== null && startDays < 0) {
    out.push({
      key: "late",
      tone: "danger",
      text: `A data de início passou há ${-startDays} ${plural(-startDays, "dia", "dias")} e a admissão não foi concluída.`,
      tab: "contratacao",
    });
  }

  if (!p.medicalExamDate && startDays !== null && startDays >= 0 && startDays <= EXAM_ALERT_WINDOW_DAYS) {
    out.push({
      key: "exam-soon",
      tone: "warning",
      text:
        startDays === 0
          ? "O início é hoje e o ASO ainda não foi agendado."
          : `Início em ${startDays} ${plural(startDays, "dia", "dias")} e o ASO ainda não foi agendado.`,
      tab: "contratacao",
    });
  } else if (!p.medicalExamDate) {
    out.push({ key: "exam", tone: "info", text: "Data do exame admissional (ASO) ainda não registrada.", tab: "contratacao" });
  } else if (p.startDate && p.medicalExamDate.slice(0, 10) > p.startDate.slice(0, 10)) {
    out.push({ key: "exam-after", tone: "warning", text: "O ASO está agendado para depois da data de início.", tab: "contratacao" });
  }

  if (p.docsRejected.length > 0) {
    out.push({
      key: "rejected",
      tone: "danger",
      text: `${p.docsRejected.join(", ")}: ${plural(p.docsRejected.length, "recusado", "recusados")} pelo RH — peça um novo envio ao candidato.`,
      tab: "documentos",
    });
  }
  if (p.missingRequiredDocs.length > 0) {
    out.push({
      key: "docs",
      tone: "warning",
      text: `${p.missingRequiredDocs.length} ${plural(p.missingRequiredDocs.length, "documento obrigatório pendente", "documentos obrigatórios pendentes")}: ${p.missingRequiredDocs.join(", ")}.`,
      tab: "documentos",
    });
  }
  if (p.docsToReview.length > 0) {
    out.push({
      key: "review",
      tone: "warning",
      text: `${p.docsToReview.join(", ")}: ${plural(p.docsToReview.length, "precisa", "precisam")} de revisão do RH.`,
      tab: "documentos",
    });
  }

  const fillText = p.formFill
    ? `${p.formFill.requiredDone} de ${p.formFill.requiredTotal} documentos obrigatórios`
    : null;
  if (p.formState === "EXPIRED") {
    out.push({
      key: "form",
      tone: "warning",
      text: fillText
        ? `O link do formulário expirou antes do envio final (o candidato tinha enviado ${fillText}).`
        : "O link do formulário expirou sem resposta do candidato.",
    });
  } else if (p.formState === "WAITING" && fillText) {
    out.push({
      key: "form",
      tone: "info",
      text: `O candidato começou o formulário (${fillText}), mas ainda não concluiu o envio.`,
    });
  } else if (p.formState === "WAITING") {
    out.push({ key: "form", tone: "info", text: "Formulário enviado ao candidato, aguardando preenchimento." });
  } else if (p.formState === "NOT_SENT") {
    out.push({ key: "form", tone: "info", text: "O formulário de admissão ainda não foi enviado ao candidato." });
  }

  if (p.cpf && p.cpf.replace(/\D/g, "").length > 0 && !isValidCpf(p.cpf)) {
    out.push({ key: "cpf", tone: "warning", text: "O CPF cadastrado é inválido.", tab: "dados" });
  }
  if (!p.startDate) out.push({ key: "start", tone: "info", text: "Data de início ainda não definida.", tab: "contratacao" });
  if (!p.hasStage) out.push({ key: "stage", tone: "info", text: "A admissão ainda não tem etapa definida.", tab: "contratacao" });

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

// ─── Rascunho (campos editáveis) ────────────────────────────────────────────────────────

export interface AdmissionDraft {
  fullName: string;
  cpf: string;
  email: string;
  phone: string;
  birthDate: string;
  positionId: string;
  companyId: string;
  branchId: string;
  stageId: string;
  responsibleId: string;
  managerName: string;
  startDate: string;
  medicalExamDate: string;
  /** Dígitos do salário em centavos ("280000" = R$ 2.800,00). */
  salaryDigits: string;
  shift: string;
  uniformShirt: string;
  uniformPants: string;
  uniformShoe: string;
  notes: string;
}

export type DraftField = keyof AdmissionDraft;

/** Seção em que cada campo é editado (para abrir a seção certa quando há erro). */
export const FIELD_SECTION: Record<DraftField, AdmissionSection> = {
  fullName: "pessoais",
  cpf: "pessoais",
  email: "pessoais",
  phone: "pessoais",
  birthDate: "pessoais",
  positionId: "contratacao",
  companyId: "contratacao",
  branchId: "contratacao",
  stageId: "contratacao",
  responsibleId: "contratacao",
  managerName: "contratacao",
  startDate: "contratacao",
  medicalExamDate: "contratacao",
  salaryDigits: "contratacao",
  shift: "contratacao",
  uniformShirt: "recursos",
  uniformPants: "recursos",
  uniformShoe: "recursos",
  notes: "notas",
};

export function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Valor do banco (numeric → "1500.00" ou número) → dígitos em centavos. */
export function salaryToDigits(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 100)) : "";
}

/** Dígitos em centavos → "R$ 2.800,00" (máscara do input e exibição). */
export function formatSalaryDigits(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 12);
  if (!d) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(parseInt(d, 10) / 100)
    .replace(/ /g, " ");
}

export interface AdmissionRecord {
  fullName: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  positionId: string | null;
  companyId: string | null;
  branchId: string | null;
  stageId: string | null;
  responsibleId: string | null;
  managerName: string | null;
  startDate: string | null;
  medicalExamDate: string | null;
  salary: number | string | null;
  shift: string | null;
  uniformShirt: string | null;
  uniformPants: string | null;
  uniformShoe: string | null;
  notes: string | null;
}

export function admissionToDraft(a: AdmissionRecord): AdmissionDraft {
  return {
    fullName: a.fullName ?? "",
    cpf: maskCpf(a.cpf ?? ""),
    email: a.email ?? "",
    phone: maskPhone(a.phone ?? ""),
    birthDate: a.birthDate ? a.birthDate.slice(0, 10) : "",
    positionId: a.positionId ?? "",
    companyId: a.companyId ?? "",
    branchId: a.branchId ?? "",
    stageId: a.stageId ?? "",
    responsibleId: a.responsibleId ?? "",
    managerName: a.managerName ?? "",
    startDate: a.startDate ? a.startDate.slice(0, 10) : "",
    medicalExamDate: a.medicalExamDate ? a.medicalExamDate.slice(0, 10) : "",
    salaryDigits: salaryToDigits(a.salary),
    shift: a.shift ?? "",
    uniformShirt: a.uniformShirt ?? "",
    uniformPants: a.uniformPants ?? "",
    uniformShoe: a.uniformShoe ?? "",
    notes: a.notes ?? "",
  };
}

/**
 * Corpo do PATCH /api/admissoes/[id] (mesmo contrato do formulário antigo: strings, vazio =
 * null no schema). A origem (vaga/candidatura) nunca vai no corpo — é definida na criação.
 */
export function draftToPayload(d: AdmissionDraft): Record<string, string> {
  const { salaryDigits, ...rest } = d;
  const trimmed = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
  return {
    ...trimmed,
    salary: salaryDigits ? (parseInt(salaryDigits, 10) / 100).toFixed(2) : "",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Erros por campo. CPF, telefone e nascimento só são checados quando o RH os altera —
 * um cadastro antigo com dado incompleto não impede salvar outra informação (a pendência
 * "CPF inválido" continua avisando).
 */
export function validateDraft(
  d: AdmissionDraft,
  saved: AdmissionDraft,
  today: Date = new Date()
): Partial<Record<DraftField, string>> {
  const errors: Partial<Record<DraftField, string>> = {};
  if (d.fullName.trim().length < 3) errors.fullName = "Informe o nome completo.";
  if (d.cpf !== saved.cpf && d.cpf) {
    const digits = d.cpf.replace(/\D/g, "");
    if (digits.length !== 11) errors.cpf = "CPF incompleto.";
    else if (!isValidCpf(digits)) errors.cpf = "CPF inválido.";
  }
  if (d.email.trim() && !EMAIL_RE.test(d.email.trim())) errors.email = "E-mail inválido.";
  if (d.phone !== saved.phone && d.phone && d.phone.replace(/\D/g, "").length < 10) {
    errors.phone = "Telefone incompleto — inclua o DDD.";
  }
  if (d.birthDate !== saved.birthDate && d.birthDate && daysFromToday(d.birthDate, today) > 0) {
    errors.birthDate = "A data de nascimento não pode ser no futuro.";
  }
  return errors;
}

/** Campos alterados em relação ao salvo (para o estado "sujo" por seção). */
export function changedFields(d: AdmissionDraft, saved: AdmissionDraft): DraftField[] {
  return (Object.keys(d) as DraftField[]).filter((k) => d[k] !== saved[k]);
}
