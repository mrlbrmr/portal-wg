// Separação conceitual STATUS da vaga × ETAPA do processo — só na apresentação.
//
// No banco, o enum JobStatus mistura as duas dimensões: DRAFT/PAUSED/CLOSED/FILLED são
// status de ciclo de vida, enquanto ACTIVE/SCREENING/INTERVIEW/ADMISSION são "aberta" em
// fases diferentes do processo. Este módulo projeta o enum nas duas dimensões sem alterar
// o schema: a UI mostra "Aberta" + "Entrevistas" em vez de tratar "Entrevistas" como status.
// Se um dia o banco separar as colunas, só este arquivo muda.

import type { Tone } from "@/components/ui/StatusBadge";

/** Status de ciclo de vida da vaga, como o RH fala. */
export type JobLifecycle = "DRAFT" | "OPEN" | "PAUSED" | "FILLED" | "CLOSED";

/** Etapa em que o processo seletivo de uma vaga ABERTA se encontra. */
export type JobProcessStage = "SCREENING" | "INTERVIEW" | "ADMISSION";

export const JOB_LIFECYCLE_ORDER: JobLifecycle[] = ["DRAFT", "OPEN", "PAUSED", "FILLED", "CLOSED"];
export const JOB_STAGE_ORDER: JobProcessStage[] = ["SCREENING", "INTERVIEW", "ADMISSION"];

export const JOB_LIFECYCLE_META: Record<JobLifecycle, { label: string; tone: Tone; hint: string }> = {
  DRAFT: { label: "Rascunho", tone: "neutral", hint: "Em preparação — ainda não publicada" },
  OPEN: { label: "Aberta", tone: "success", hint: "Publicada e recebendo candidaturas" },
  PAUSED: { label: "Pausada", tone: "warning", hint: "Fora do ar temporariamente" },
  FILLED: { label: "Encerrada", tone: "info", hint: "Vaga preenchida — processo concluído" },
  CLOSED: { label: "Cancelada", tone: "neutral", hint: "Processo cancelado sem contratação" },
};

export const JOB_STAGE_META: Record<JobProcessStage, { label: string; color: string }> = {
  SCREENING: { label: "Triagem", color: "#D9873C" },
  INTERVIEW: { label: "Entrevistas", color: "#3C56A8" },
  ADMISSION: { label: "Admissão", color: "#4F6930" },
};

const OPEN_STATUSES = new Set(["ACTIVE", "SCREENING", "INTERVIEW", "ADMISSION"]);

/**
 * STATUS DO PROCESSO SELETIVO, como aparece na página da vaga (um valor do enum por
 * opção — o banco não muda). O preenchimento das posições é OUTRA dimensão
 * (src/lib/jobs/positions.ts): "Entrevistas" + "1 de 2 posições preenchidas".
 */
export const JOB_PROCESS_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Recebendo candidaturas",
  SCREENING: "Triagem",
  INTERVIEW: "Entrevistas",
  ADMISSION: "Admissão",
  PAUSED: "Pausada",
  CLOSED: "Cancelada",
  FILLED: "Encerrada",
};

export interface JobStatusOption {
  value: string;
  label: string;
  hint: string;
}

/** Opções do seletor de status, agrupadas pela visibilidade no portal. */
export const JOB_STATUS_OPTION_GROUPS: Array<{ label: string; options: JobStatusOption[] }> = [
  {
    label: "No portal (aceita candidaturas)",
    options: [
      { value: "ACTIVE", label: "Recebendo candidaturas", hint: "Publicada, início do processo." },
      { value: "SCREENING", label: "Triagem", hint: "Publicada; RH analisando currículos." },
      { value: "INTERVIEW", label: "Entrevistas", hint: "Publicada; candidatos em entrevista." },
      { value: "ADMISSION", label: "Admissão", hint: "Publicada; finalistas em admissão." },
    ],
  },
  {
    label: "Fora do portal",
    options: [
      { value: "DRAFT", label: "Rascunho", hint: "Em preparação — só no painel." },
      { value: "PAUSED", label: "Pausada", hint: "Fora do ar temporariamente." },
      { value: "FILLED", label: "Encerrada", hint: "Processo concluído — posições preenchidas." },
      { value: "CLOSED", label: "Cancelada", hint: "Processo cancelado sem contratação." },
    ],
  },
];

export function jobLifecycle(status: string): JobLifecycle {
  if (OPEN_STATUSES.has(status)) return "OPEN";
  if (status === "DRAFT" || status === "PAUSED" || status === "FILLED" || status === "CLOSED") return status;
  return "DRAFT";
}

export function jobProcessStage(status: string): JobProcessStage | null {
  return status === "SCREENING" || status === "INTERVIEW" || status === "ADMISSION" ? status : null;
}

/** Status do banco que correspondem a um status de ciclo de vida. */
export function statusesForLifecycle(l: JobLifecycle): string[] {
  return l === "OPEN" ? [...OPEN_STATUSES] : [l];
}

/**
 * Converte o parâmetro legado `?status=` (enum cru do banco, usado em links antigos e
 * no Dashboard) para o par status/etapa da nova UI.
 */
export function parseLegacyStatusParam(raw: string | undefined | null): {
  lifecycle: JobLifecycle[];
  stage: JobProcessStage[];
} {
  const lifecycle: JobLifecycle[] = [];
  const stage: JobProcessStage[] = [];
  for (const v of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    if (v === "ACTIVE" || v === "OPEN" || v === "ATIVAS") lifecycle.push("OPEN");
    else if (v === "SCREENING" || v === "INTERVIEW" || v === "ADMISSION") {
      lifecycle.push("OPEN");
      stage.push(v);
    } else if ((JOB_LIFECYCLE_ORDER as string[]).includes(v)) lifecycle.push(v as JobLifecycle);
  }
  return { lifecycle: [...new Set(lifecycle)], stage: [...new Set(stage)] };
}
