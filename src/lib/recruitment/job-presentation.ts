// Status da vaga — só na apresentação.
//
// A vaga tem apenas status de ciclo de vida (Rascunho, Aberta, Pausada, Encerrada, Cancelada).
// O andamento do processo seletivo é dos CANDIDATOS (pipeline/ATS), não da vaga.
// SCREENING/INTERVIEW/ADMISSION seguem no enum do banco só por legado (colunas do antigo
// Kanban de vagas): valem exatamente como ACTIVE e a UI não os oferece nem exibe.

import type { Tone } from "@/components/ui/StatusBadge";
import { publicationIndicator } from "@/lib/jobs/publication";

/** Status de ciclo de vida da vaga, como o RH fala. */
export type JobLifecycle = "DRAFT" | "OPEN" | "PAUSED" | "FILLED" | "CLOSED";

export const JOB_LIFECYCLE_ORDER: JobLifecycle[] = ["DRAFT", "OPEN", "PAUSED", "FILLED", "CLOSED"];

export const JOB_LIFECYCLE_META: Record<JobLifecycle, { label: string; tone: Tone; hint: string }> = {
  DRAFT: { label: "Rascunho", tone: "neutral", hint: "Em preparação — ainda não publicada" },
  OPEN: { label: "Aberta", tone: "success", hint: "Processo seletivo em andamento" },
  PAUSED: { label: "Pausada", tone: "warning", hint: "Fora do ar temporariamente" },
  FILLED: { label: "Encerrada", tone: "info", hint: "Vaga preenchida — processo concluído" },
  CLOSED: { label: "Cancelada", tone: "neutral", hint: "Processo cancelado sem contratação" },
};

const OPEN_STATUSES = new Set(["ACTIVE", "SCREENING", "INTERVIEW", "ADMISSION"]);
const LEGACY_STAGE_STATUSES = new Set(["SCREENING", "INTERVIEW", "ADMISSION"]);

/** Status legado de etapa (Triagem/Entrevistas/Admissão) é tratado como ACTIVE na UI. */
export function canonicalJobStatus(status: string): string {
  return LEGACY_STAGE_STATUSES.has(status) ? "ACTIVE" : status;
}

/**
 * Rótulo do status como aparece na página da vaga. O preenchimento das posições é OUTRA
 * dimensão (src/lib/jobs/positions.ts). Para o status ATUAL use `canonicalJobStatus` antes;
 * os rótulos legados ficam só para o histórico mostrar o que de fato foi gravado.
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

/**
 * Opções do seletor de status do PROCESSO. Onde a vaga aparece é outra decisão (publicação,
 * src/lib/jobs/publication.ts): uma vaga aberta pode estar "Não publicar".
 */
export const JOB_STATUS_OPTION_GROUPS: Array<{ label: string; options: JobStatusOption[] }> = [
  {
    label: "Processo aberto",
    options: [
      { value: "ACTIVE", label: "Recebendo candidaturas", hint: "Processo ativo; aparece onde a publicação indicar." },
    ],
  },
  {
    label: "Processo fora do ar",
    options: [
      { value: "DRAFT", label: "Rascunho", hint: "Em preparação — só no painel." },
      { value: "PAUSED", label: "Pausada", hint: "Fora do ar temporariamente." },
      { value: "FILLED", label: "Encerrada", hint: "Processo concluído — posições preenchidas." },
      { value: "CLOSED", label: "Cancelada", hint: "Processo cancelado sem contratação." },
    ],
  },
];

/**
 * Status como aparece nas listas do painel: o ciclo de vida e, com o processo aberto, a
 * publicação — "Aberta • Publicada" × "Aberta • Não publicada". "Não publicada" NÃO é
 * rascunho: a vaga está pronta e propositalmente fora dos canais.
 */
export function jobStatusDisplay(job: { status: string; visibility?: string | null }): { label: string; tone: Tone; hint: string } {
  const meta = JOB_LIFECYCLE_META[jobLifecycle(job.status)];
  const pub = publicationIndicator({ status: job.status, visibility: job.visibility ?? "BOTH" });
  if (!pub) return meta;
  return {
    label: `${meta.label} • ${pub.label}`,
    tone: pub.label === "Publicada" ? "success" : "info",
    hint: pub.label === "Publicada" ? `Recebendo candidaturas — ${pub.hint}` : pub.hint,
  };
}

export function jobLifecycle(status: string): JobLifecycle {
  if (OPEN_STATUSES.has(status)) return "OPEN";
  if (status === "DRAFT" || status === "PAUSED" || status === "FILLED" || status === "CLOSED") return status;
  return "DRAFT";
}

/** Status do banco que correspondem a um status de ciclo de vida. */
export function statusesForLifecycle(l: JobLifecycle): string[] {
  return l === "OPEN" ? [...OPEN_STATUSES] : [l];
}

/**
 * Converte o parâmetro `?status=` em status de ciclo de vida. Aceita também o enum cru do
 * banco (links antigos): ACTIVE e as etapas legadas viram "Aberta".
 */
export function parseLegacyStatusParam(raw: string | undefined | null): JobLifecycle[] {
  const lifecycle: JobLifecycle[] = [];
  for (const v of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    if (v === "OPEN" || v === "ATIVAS" || OPEN_STATUSES.has(v)) lifecycle.push("OPEN");
    else if ((JOB_LIFECYCLE_ORDER as string[]).includes(v)) lifecycle.push(v as JobLifecycle);
  }
  return [...new Set(lifecycle)];
}
