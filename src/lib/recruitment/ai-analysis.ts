// Análise de currículo por IA, pronta para a tela — módulo PURO.
//
// A análise é gravada em application_assessments (kind=AI_FIT). Desde 2026-09 o resultado
// estruturado vai em `metadata` (critérios, pontos fortes, lacunas, resumo profissional);
// análises antigas só têm o texto `summary`, montado pela rota /analyze num formato fixo
// ("Pontos fortes:" / "Lacunas:" com "• "). Este módulo lê os dois — sem inventar nada:
// o que não existe na análise volta vazio/null e a UI omite.
//
// A IA é APOIO à decisão: os rótulos descrevem aderência aos critérios da vaga, nunca
// dizem "contrate"/"reprove".

import type { Tone } from "@/components/ui/StatusBadge";

export type AiCriterionStatus = "MEETS" | "PARTIAL" | "NOT_FOUND";

export interface AiCriterion {
  criterion: string;
  status: AiCriterionStatus;
  evidence: string | null;
}

/** Formato de application_assessments.metadata gravado pela rota /analyze (version 2). */
export interface AiAnalysisMetadata {
  version: 2;
  model: string;
  profileSummary: string | null;
  fitReason: string;
  strengths: string[];
  gaps: string[];
  criteria: AiCriterion[];
  profile: {
    experienceYears: number | null;
    education: string | null;
    lastPosition: string | null;
    skills: string[];
  };
}

export interface AiAssessmentRow {
  id: string;
  score: number | null;
  summary: string | null;
  evaluator: string | null;
  metadata?: unknown;
  occurredAt: string | null;
  createdAt: string;
}

export type AiFitBand = "HIGH" | "PARTIAL" | "LOW";

/** Perfil lido do currículo pela própria análise (complementa applications.cv_profile). */
export interface AiProfile {
  experienceYears: number | null;
  education: string | null;
  lastPosition: string | null;
  skills: string[];
}

export interface AiAnalysis {
  id: string;
  score: number | null;
  band: AiFitBand | null;
  /** Por que a IA chegou ao score (2–4 frases). */
  reason: string | null;
  /** Uma frase sobre o profissional — só existe em análises estruturadas. */
  profileSummary: string | null;
  strengths: string[];
  gaps: string[];
  /** Requisitos da vaga avaliados um a um — só em análises estruturadas. */
  criteria: AiCriterion[];
  profile: AiProfile;
  analyzedAt: string;
  /** "Gemini" — rótulo curto, sem versão técnica. */
  engine: string | null;
  /** Texto completo gravado (para "Ver análise completa"). */
  fullText: string | null;
}

/** Tooltip do (i) de aderência: o que o número significa — e o que ele não é. */
export const MATCH_BASIS_HINT = "Calculado com base nos critérios definidos para esta vaga.";

export const AI_FIT_BAND_META: Record<AiFitBand, { label: string; summary: string; tone: Tone; hint: string }> = {
  HIGH: {
    label: "Recomendado para análise",
    summary: "Boa compatibilidade com os critérios da vaga.",
    tone: "success",
    hint: "Atende à maior parte dos critérios da vaga identificáveis no currículo.",
  },
  PARTIAL: {
    label: "Aderência parcial",
    summary: "Compatibilidade parcial com os critérios da vaga.",
    tone: "neutral",
    hint: "Atende a parte dos critérios da vaga identificáveis no currículo.",
  },
  LOW: {
    label: "Baixa aderência",
    summary: "Poucos critérios da vaga identificados no currículo.",
    tone: "neutral",
    hint: "Poucos critérios da vaga foram identificados no currículo — confira o arquivo.",
  },
};

export const AI_CRITERION_META: Record<AiCriterionStatus, { label: string; tone: Tone }> = {
  MEETS: { label: "Atende", tone: "success" },
  PARTIAL: { label: "Parcial", tone: "warning" },
  NOT_FOUND: { label: "Não identificado", tone: "neutral" },
};

/** Mesmos cortes do parecer gravado pela rota /analyze (70 / 50). */
export function aiFitBand(score: number | null | undefined): AiFitBand | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  if (score >= 70) return "HIGH";
  if (score >= 50) return "PARTIAL";
  return "LOW";
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()) : [];
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function readMetadata(raw: unknown): Partial<AiAnalysisMetadata> | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  return m.version === 2 ? (m as Partial<AiAnalysisMetadata>) : null;
}

const PROFILE_LINE = /^(Último cargo|Experiência|Formação|Habilidades):/i;

/**
 * Lê o texto legado gravado pela rota /analyze:
 *   <motivo>
 *   Último cargo: … · Experiência: … (opcional)
 *   Pontos fortes:\n• …
 *   Lacunas:\n• …
 */
export function parseLegacySummary(summary: string): {
  reason: string | null;
  strengths: string[];
  gaps: string[];
  profile: AiProfile;
} {
  const profile: AiProfile = { experienceYears: null, education: null, lastPosition: null, skills: [] };
  const reason: string[] = [];
  const strengths: string[] = [];
  const gaps: string[] = [];
  let section: "reason" | "strengths" | "gaps" | "other" = "reason";

  for (const raw of summary.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^pontos fortes:?$/i.test(line)) {
      section = "strengths";
      continue;
    }
    if (/^lacunas:?$/i.test(line)) {
      section = "gaps";
      continue;
    }
    if (PROFILE_LINE.test(line)) {
      section = "other";
      for (const part of line.split(" · ")) {
        const [key, ...rest] = part.split(":");
        const value = rest.join(":").trim();
        if (!value) continue;
        const k = key.trim().toLowerCase();
        if (k === "último cargo") profile.lastPosition = value;
        else if (k === "formação") profile.education = value;
        else if (k === "habilidades") profile.skills = value.split(",").map((x) => x.trim()).filter(Boolean);
        else if (k === "experiência") {
          const n = Number.parseFloat(value.replace(",", "."));
          profile.experienceYears = Number.isFinite(n) ? n : null;
        }
      }
      continue;
    }
    const bullet = /^[•\-*]\s+/.test(line) ? line.replace(/^[•\-*]\s+/, "") : null;
    if (section === "strengths" && bullet) strengths.push(bullet);
    else if (section === "gaps" && bullet) gaps.push(bullet);
    else if (section === "reason") reason.push(line.replace(/\*\*/g, ""));
  }

  return { reason: reason.length ? reason.join(" ") : null, strengths, gaps, profile };
}

function engineLabel(model: string | null | undefined, evaluator: string | null): string | null {
  const src = `${model ?? ""} ${evaluator ?? ""}`.toLowerCase();
  if (src.includes("gemini")) return "Gemini";
  if (src.includes("claude")) return "Claude";
  if (src.includes("groq") || src.includes("llama")) return "Llama";
  return evaluator?.replace(/^IA\s*·\s*/i, "").trim() || null;
}

export function parseAiAnalysis(row: AiAssessmentRow): AiAnalysis {
  const meta = readMetadata(row.metadata);
  const legacy = parseLegacySummary(row.summary ?? "");
  const score = row.score === null || row.score === undefined ? null : Math.round(Number(row.score));

  const criteria: AiCriterion[] = Array.isArray(meta?.criteria)
    ? meta.criteria
        .filter((c) => c && typeof c.criterion === "string" && c.criterion.trim())
        .map((c) => ({
          criterion: c.criterion.trim(),
          status: (["MEETS", "PARTIAL", "NOT_FOUND"] as const).includes(c.status) ? c.status : "NOT_FOUND",
          evidence: text(c.evidence),
        }))
    : [];

  return {
    id: row.id,
    score: Number.isFinite(score) ? score : null,
    band: aiFitBand(score),
    reason: text(meta?.fitReason) ?? legacy.reason,
    profileSummary: text(meta?.profileSummary),
    strengths: meta ? strings(meta.strengths) : legacy.strengths,
    gaps: meta ? strings(meta.gaps) : legacy.gaps,
    criteria,
    profile: meta?.profile
      ? {
          experienceYears: typeof meta.profile.experienceYears === "number" ? meta.profile.experienceYears : null,
          education: text(meta.profile.education),
          lastPosition: text(meta.profile.lastPosition),
          skills: strings(meta.profile.skills),
        }
      : legacy.profile,
    analyzedAt: row.occurredAt ?? row.createdAt,
    engine: engineLabel(meta?.model, row.evaluator),
    fullText: text(row.summary),
  };
}

/** A análise de IA mais recente entre as avaliações (a rota mantém só uma, mas não confiamos). */
export function latestAiAnalysis<T extends AiAssessmentRow & { kind: string; source: string }>(rows: T[]): AiAnalysis | null {
  const ai = rows
    .filter((r) => r.kind === "AI_FIT" && r.source === "AI")
    .sort((a, b) => new Date(b.occurredAt ?? b.createdAt).getTime() - new Date(a.occurredAt ?? a.createdAt).getTime())[0];
  return ai ? parseAiAnalysis(ai) : null;
}
