// Apresentação de candidaturas no pipeline da vaga (Kanban, lista, comparação) — módulo PURO.
//
// Tudo aqui é derivado de dados que já existem no banco: datas de candidatura e de
// entrada na etapa (application_stage_history), sessões de teste, avaliações datadas,
// status da leitura do CV por IA. Nada é inventado: sem dado, a função devolve null e a
// UI simplesmente não mostra a linha/badge.

import type { Tone } from "@/components/ui/StatusBadge";
import { pipelineStages, type FlowStage } from "@/lib/recruitment/candidate-stage-flow";

const TIME_ZONE = "America/Sao_Paulo";

// ── Avatar ───────────────────────────────────────────────────────────────────

const NAME_PARTICLES = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "del"]);

/** "Wellington Marcelo de Souza" → "WM"; "Ana" → "AN". Ignora partículas (de, da…). */
export function candidateInitials(fullName: string): string {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter((w) => w && !NAME_PARTICLES.has(w.toLowerCase()));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Paleta de avatares: tons dessaturados, harmônicos com o verde institucional. Pares
 * bg/fg com contraste AA para as iniciais. A cor é estável por candidato (hash do id).
 */
export const AVATAR_TONES: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: "#E6EEDB", fg: "#3E5A2A" }, // sálvia
  { bg: "#E3E9F2", fg: "#37496A" }, // ardósia
  { bg: "#F1E9D8", fg: "#6B501C" }, // areia
  { bg: "#DDEDE8", fg: "#2D5A51" }, // verde-água
  { bg: "#ECE4EA", fg: "#61455D" }, // malva
  { bg: "#EEE6DE", fg: "#654A36" }, // argila
];

export function avatarTone(seed: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

// ── Datas relativas ──────────────────────────────────────────────────────────

/** "AAAA-MM-DD" do instante no fuso de São Paulo. */
function localDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayNumber(isoDay: string): number {
  const [y, m, d] = isoDay.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Dias de CALENDÁRIO (fuso de São Paulo) entre a data e agora. "Ontem às 23h" = 1. */
export function calendarDaysSince(date: Date | string, now: Date = new Date()): number {
  return Math.max(0, dayNumber(localDay(now)) - dayNumber(localDay(new Date(date))));
}

/** "hoje", "ontem", "há 5 dias", "há 1 mês", "há 3 meses". */
export function relativeDay(date: Date | string, now: Date = new Date()): string {
  const d = calendarDaysSince(date, now);
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  const months = Math.round(d / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

/** "Candidatou-se hoje", "Candidatou-se ontem", "Candidatou-se há 2 dias". */
export function formatAppliedAgo(createdAt: Date | string, now: Date = new Date()): string {
  return `Candidatou-se ${relativeDay(createdAt, now)}`;
}

/** Duração curta em dias: "hoje", "1 dia", "12 dias", "2 meses". */
export function formatDaysShort(date: Date | string, now: Date = new Date()): string {
  const d = calendarDaysSince(date, now);
  if (d === 0) return "hoje";
  if (d === 1) return "1 dia";
  if (d < 60) return `${d} dias`;
  return `${Math.round(d / 30)} meses`;
}

/** "Entrou nesta etapa hoje", "Nesta etapa há 1 dia", "Nesta etapa há 4 dias". */
export function formatStageTime(enteredAt: Date | string, now: Date = new Date()): string {
  const d = calendarDaysSince(enteredAt, now);
  if (d === 0) return "Entrou nesta etapa hoje";
  return `Nesta etapa há ${formatDaysShort(enteredAt, now)}`;
}

/**
 * Quando a candidatura entrou na etapa atual, a partir do registro MAIS RECENTE do
 * histórico. Se ele não for a etapa atual (dado legado/inconsistente), devolve null — a
 * UI omite "Nesta etapa há …" em vez de chutar.
 */
export function enteredStageAtFromLatest(
  latest: { stageId: string | null; changedAt: string } | undefined,
  currentStageId: string
): string | null {
  return latest && latest.stageId === currentStageId ? latest.changedAt : null;
}

// ── Resumo do pipeline ───────────────────────────────────────────────────────

export type PipelineGroup = "NEW" | "IN_PROCESS" | "FINALIST" | "CLOSED";

export const PIPELINE_GROUP_META: Record<PipelineGroup, { label: string; hint: string }> = {
  NEW: { label: "novos", hint: "Na primeira etapa do funil, ainda sem triagem." },
  IN_PROCESS: { label: "em processo", hint: "Em triagem, testes ou entrevistas." },
  FINALIST: { label: "finalistas", hint: "Nas etapas de admissão ou finalizada." },
  CLOSED: {
    label: "fora do funil",
    hint: "Reprovados, cancelados ou pausados — não aparecem nas colunas do Kanban.",
  },
};

/** Em que grupo do resumo a etapa cai. Baseado no `kind` e na ordem configurada. */
export function pipelineGroup(stage: FlowStage | undefined, stages: FlowStage[]): PipelineGroup {
  if (!stage || stage.kind === "LOST" || stage.hideFromBoard) return "CLOSED";
  if (stage.kind === "ADMISSION" || stage.kind === "WON") return "FINALIST";
  const first = pipelineStages(stages)[0];
  return first && first.id === stage.id ? "NEW" : "IN_PROCESS";
}

export function pipelineSummary(
  items: Array<{ stageId: string }>,
  stages: FlowStage[]
): { total: number } & Record<PipelineGroup, number> {
  const byId = new Map(stages.map((s) => [s.id, s]));
  const out = { total: items.length, NEW: 0, IN_PROCESS: 0, FINALIST: 0, CLOSED: 0 };
  for (const it of items) out[pipelineGroup(byId.get(it.stageId), stages)]++;
  return out;
}

// ── Sinais operacionais (badges do card) ─────────────────────────────────────

/**
 * Dias parado na mesma etapa (do funil em andamento) a partir dos quais o card sinaliza
 * "Parado há N dias". Regra de apresentação, não de negócio: pode virar configuração do
 * RH sem mudar nenhuma tela. `null` desliga o alerta.
 */
export const STAGE_IDLE_WARNING_DAYS: number | null = 7;

/** Situação do teste de uma candidatura que está numa etapa TEST. */
export type TestStatus = "NOT_SENT" | "AWAITING" | "PENDING_REVIEW" | "PASS" | "FAIL";

export type SignalIcon = "test" | "calendar" | "clock" | "file" | "brain";

export interface CandidateSignal {
  key: string;
  label: string;
  tone: Tone;
  icon: SignalIcon;
  hint?: string;
  /** Pede ação do recrutador — conta em "Precisa de atenção". */
  attention: boolean;
}

export interface SignalInput {
  stageId: string;
  enteredStageAt: string | null;
  testStatus?: TestStatus;
  /** Próxima entrevista registrada com data (ISO) — só futuras ou de hoje. */
  nextInterviewAt?: string | null;
  cvExtractionStatus?: string;
  bigFiveDone?: boolean;
  /** A IA já calculou a aderência — prova de que o currículo é legível. */
  hasScore?: boolean;
}

const TEST_SIGNAL: Record<TestStatus, Omit<CandidateSignal, "key" | "icon">> = {
  NOT_SENT: { label: "Teste não enviado", tone: "warning", attention: true, hint: "Etapa de teste sem link enviado ao candidato." },
  AWAITING: { label: "Aguardando teste", tone: "info", attention: false, hint: "Link enviado; o candidato ainda não respondeu." },
  PENDING_REVIEW: { label: "Teste para corrigir", tone: "warning", attention: true, hint: "Teste respondido aguardando correção do RH." },
  PASS: { label: "Teste aprovado", tone: "success", attention: false },
  FAIL: { label: "Teste reprovado", tone: "neutral", attention: false },
};

/** Data de calendário de uma entrevista. As datas só-dia são gravadas em UTC (00h/12h). */
function interviewDay(iso: string): string {
  return iso.slice(0, 10);
}

export function formatInterviewLabel(iso: string, now: Date = new Date()): string | null {
  const diff = dayNumber(interviewDay(iso)) - dayNumber(localDay(now));
  if (diff < 0) return null;
  if (diff === 0) return "Entrevista hoje";
  if (diff === 1) return "Entrevista amanhã";
  const [, m, d] = interviewDay(iso).split("-");
  return `Entrevista ${d}/${m}`;
}

/** Sinais do card, do mais ao menos importante. A UI mostra só os primeiros. */
export function candidateSignals(
  input: SignalInput,
  stage: FlowStage | undefined,
  now: Date = new Date()
): CandidateSignal[] {
  const out: CandidateSignal[] = [];

  if (stage?.kind === "TEST" && input.testStatus) {
    out.push({ key: "test", icon: "test", ...TEST_SIGNAL[input.testStatus] });
  }

  if (input.nextInterviewAt) {
    const label = formatInterviewLabel(input.nextInterviewAt, now);
    if (label) out.push({ key: "interview", icon: "calendar", label, tone: "info", attention: false });
  }

  const inActiveFunnel = stage && !stage.hideFromBoard && (stage.kind === "OPEN" || stage.kind === "TEST" || !stage.kind);
  if (STAGE_IDLE_WARNING_DAYS !== null && inActiveFunnel && input.enteredStageAt) {
    const days = calendarDaysSince(input.enteredStageAt, now);
    if (days >= STAGE_IDLE_WARNING_DAYS) {
      out.push({
        key: "idle",
        icon: "clock",
        label: `Parado há ${days} dias`,
        tone: "warning",
        attention: true,
        hint: `Sem mudança de etapa há ${days} dias (alerta a partir de ${STAGE_IDLE_WARNING_DAYS}).`,
      });
    }
  }

  // Só sinaliza quando nem a análise de aderência conseguiu ler o arquivo.
  if (!input.hasScore && (input.cvExtractionStatus === "FAILED" || input.cvExtractionStatus === "MANUAL_REVIEW")) {
    out.push({
      key: "cv",
      icon: "file",
      label: "Revisar currículo",
      tone: "neutral",
      attention: false,
      hint: "A leitura automática do currículo falhou — confira o arquivo manualmente.",
    });
  }

  if (input.bigFiveDone && !(stage?.kind === "TEST" && input.testStatus)) {
    out.push({ key: "bigfive", icon: "brain", label: "Big Five concluído", tone: "success", attention: false });
  }

  return out;
}

// ── Aderência ────────────────────────────────────────────────────────────────

export const MATCH_SCORE_HINT =
  "Indicador baseado nos requisitos da vaga e nas informações disponíveis do candidato. Utilize como apoio à triagem.";

/** "5+ anos de exp." / "1 ano de exp." / "Menos de 1 ano" — a partir do perfil do CV. */
export function formatExperience(years: number | null | undefined): string | null {
  if (years === null || years === undefined || !Number.isFinite(years) || years < 0) return null;
  if (years < 1) return "Menos de 1 ano de exp.";
  if (years === 1) return "1 ano de exp.";
  return `${Math.floor(years)} anos de exp.`;
}

/** "Curitiba/PR", "Curitiba", "PR" ou null. */
export function formatCandidateLocation(city: string | null | undefined, uf: string | null | undefined): string | null {
  const c = city?.trim();
  const u = uf?.trim().toUpperCase();
  if (c && u) return `${c}/${u}`;
  return c || u || null;
}
