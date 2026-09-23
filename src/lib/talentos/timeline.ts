// Linha do tempo do RELACIONAMENTO do talento com a empresa — módulo PURO.
//
// Só eventos reais, de fontes que já existem no banco:
//   • entrada no banco (talentos.createdAt)
//   • candidaturas (applications) — candidatou-se / cadastrado pelo RH / adicionado pelo banco
//   • mudanças de etapa (application_stage_history), por vaga
//   • avaliações concluídas (assessment_sessions.submittedAt)
//   • ações do RH registradas em talento_audit_log (tags, status, arquivamento, edição)
// Todos são somente leitura: refletem o que aconteceu, não podem ser editados.

import type { Tone } from "@/components/ui/StatusBadge";
import { ORIGIN_LABELS } from "./crm";
import type { TalentAuditEvent, TalentApplication, TalentSession, TalentStageEvent } from "./profile";

export type TalentEventKind =
  | "JOINED"
  | "APPLIED"
  | "ADDED_BY_HR"
  | "ADDED_FROM_BANK"
  | "STAGE"
  | "HIRED"
  | "CLOSED"
  | "ASSESSMENT"
  | "TAGS"
  | "STATUS"
  | "ARCHIVED"
  | "RESTORED"
  | "EDITED"
  | "CREATED";

export interface TalentEvent {
  id: string;
  at: string;
  kind: TalentEventKind;
  title: string;
  detail: string | null;
  actor: string | null;
  tone: Tone;
  /** Candidatura relacionada (para "Abrir candidatura"). */
  applicationId?: string;
  jobId?: string;
}

export interface TalentTimelineInput {
  createdAt: string;
  origem: string;
  applications: TalentApplication[];
  stageHistory: TalentStageEvent[];
  sessions: TalentSession[];
  events: TalentAuditEvent[];
}

/** O registro de etapa gravado junto com a candidatura (mesma etapa, até 10 min depois). */
function isCreationEntry(h: TalentStageEvent, app: TalentApplication | undefined, firstForApp: boolean): boolean {
  if (!app || !firstForApp) return false;
  const gap = new Date(h.changedAt).getTime() - new Date(app.createdAt).getTime();
  return gap >= -60_000 && gap <= 10 * 60_000;
}

export function buildTalentTimeline(input: TalentTimelineInput): TalentEvent[] {
  const out: TalentEvent[] = [];
  const apps = new Map(input.applications.map((a) => [a.id, a]));
  const manual = input.origem === "CADASTRO_MANUAL";

  for (const a of input.applications) {
    const job = a.jobCode ? `${a.jobTitle} (${a.jobCode})` : a.jobTitle;
    if (a.source === "BANCO_TALENTOS") {
      out.push({
        id: `app-${a.id}`,
        at: a.createdAt,
        kind: "ADDED_FROM_BANK",
        title: `Adicionado à vaga ${job} pelo Banco de Talentos`,
        detail: `Etapa inicial: ${input.stageHistory.find((h) => h.applicationId === a.id)?.stageName ?? a.stageName}`,
        actor: a.addedBy,
        tone: "info",
        applicationId: a.id,
        jobId: a.jobId,
      });
    } else if (a.source === "PORTAL") {
      out.push({
        id: `app-${a.id}`,
        at: a.createdAt,
        kind: "APPLIED",
        title: `Candidatou-se à vaga ${job}`,
        detail: "Pelo portal de carreiras",
        actor: null,
        tone: "info",
        applicationId: a.id,
        jobId: a.jobId,
      });
    } else {
      out.push({
        id: `app-${a.id}`,
        at: a.createdAt,
        kind: "ADDED_BY_HR",
        title: `Cadastrado na vaga ${job}`,
        detail: `Origem: ${ORIGIN_LABELS[a.source] ?? a.source}`,
        actor: a.addedBy,
        tone: "info",
        applicationId: a.id,
        jobId: a.jobId,
      });
    }
  }

  const seen = new Set<string>();
  for (const h of input.stageHistory) {
    const app = apps.get(h.applicationId);
    const first = !seen.has(h.applicationId);
    seen.add(h.applicationId);
    if (isCreationEntry(h, app, first)) continue;
    const job = app?.jobTitle ?? "vaga";
    const kind: TalentEventKind = h.stageKind === "WON" ? "HIRED" : h.stageKind === "LOST" ? "CLOSED" : "STAGE";
    out.push({
      id: `stage-${h.id}`,
      at: h.changedAt,
      kind,
      title:
        kind === "HIRED"
          ? `Aprovado no processo ${job}`
          : kind === "CLOSED"
          ? `Processo encerrado — ${job}`
          : `Movido para ${h.stageName} — ${job}`,
      detail: kind === "STAGE" ? null : `Etapa: ${h.stageName}`,
      actor: h.changedBy,
      tone: kind === "HIRED" ? "success" : kind === "CLOSED" ? "neutral" : "info",
      applicationId: h.applicationId,
      jobId: app?.jobId,
    });
  }

  for (const s of input.sessions) {
    if (!s.submittedAt) continue;
    out.push({
      id: `session-${s.id}`,
      at: s.submittedAt,
      kind: "ASSESSMENT",
      title: `Concluiu a avaliação ${s.templateName}`,
      detail: s.invalidadoEm ? "Resultado invalidado pelo RH" : null,
      actor: null,
      tone: "success",
    });
  }

  const AUDIT: Record<string, { kind: TalentEventKind; tone: Tone }> = {
    CRIADO: { kind: "CREATED", tone: "success" },
    DADOS_EDITADOS: { kind: "EDITED", tone: "neutral" },
    TAGS_ALTERADAS: { kind: "TAGS", tone: "neutral" },
    STATUS_ALTERADO: { kind: "STATUS", tone: "warning" },
    ARQUIVADO: { kind: "ARCHIVED", tone: "neutral" },
    RESTAURADO: { kind: "RESTORED", tone: "success" },
  };
  for (const e of input.events) {
    const meta = AUDIT[e.acao];
    // ADICIONADO_A_VAGA já aparece pela própria candidatura (fonte da verdade).
    if (!meta) continue;
    out.push({
      id: `audit-${e.id}`,
      at: e.createdAt,
      kind: meta.kind,
      title: e.descricao ?? e.acao,
      detail: null,
      actor: e.actorName,
      tone: meta.tone,
    });
  }

  // Por último: no empate de horário com a 1ª candidatura, a entrada fica abaixo dela.
  // Cadastro manual tem o evento CRIADO (com autor) no log; os demais entram pelo 1º contato.
  if (!manual || !input.events.some((e) => e.acao === "CRIADO")) {
    out.push({
      id: "joined",
      at: input.createdAt,
      kind: "JOINED",
      title: "Entrou no Banco de Talentos",
      detail: manual ? "Cadastro manual" : null,
      actor: null,
      tone: "success",
    });
  }

  return out.sort((a, b) => b.at.localeCompare(a.at));
}
