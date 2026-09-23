// Catálogo de eventos da página Atividades — módulo PURO (roda no servidor e no cliente).
//
// A página junta fontes REAIS de histórico, cada uma com seu vocabulário:
//   • admissions (createdAt/createdById) ........ admissão criada
//   • admission_activity_log (action) ............ etapa, edição, ASO, formulário, documentos,
//                                                  usuários (entity USER)
//   • job_request_history (event) ................ solicitações de vaga
//   • job_events (type) + job_status_history ..... vagas
//   • application_stage_history .................. candidatos movidos no funil
//   • config_change_log .......................... configurações
//
// Aqui cada evento vira um TIPO (chave estável "categoria.acao") com rótulo, ícone e tom.
// Para suportar um evento novo: registre-o no banco com um `action` e mapeie-o abaixo.
// Ações não mapeadas do admission_activity_log (diagnóstico do bot etc.) NÃO aparecem.

import type { Tone } from "@/components/ui/StatusBadge";

export type ActivityCategory =
  | "admissoes"
  | "documentos"
  | "solicitacoes"
  | "vagas"
  | "candidatos"
  | "usuarios"
  | "configuracoes";

export const ACTIVITY_CATEGORIES: Array<{ value: ActivityCategory; label: string }> = [
  { value: "admissoes", label: "Admissões" },
  { value: "documentos", label: "Documentos" },
  { value: "solicitacoes", label: "Solicitações de vaga" },
  { value: "vagas", label: "Vagas" },
  { value: "candidatos", label: "Candidatos" },
  { value: "usuarios", label: "Usuários e acessos" },
  { value: "configuracoes", label: "Configurações" },
];

/** Ícones lógicos — o componente cliente resolve para lucide. */
export type ActivityIcon =
  | "created"
  | "edit"
  | "stage"
  | "done"
  | "exam"
  | "form-sent"
  | "form"
  | "whatsapp"
  | "doc-ok"
  | "doc-bad"
  | "undo"
  | "send"
  | "approve"
  | "reject"
  | "return"
  | "cancel"
  | "reopen"
  | "job"
  | "position"
  | "candidate"
  | "user-plus"
  | "user"
  | "shield"
  | "user-off"
  | "user-on"
  | "trash"
  | "settings"
  | "alert";

export interface ActivityTypeDef {
  label: string;
  category: ActivityCategory;
  icon: ActivityIcon;
  tone: Tone;
}

export const ACTIVITY_TYPES = {
  "admission.created": { label: "Admissão criada", category: "admissoes", icon: "created", tone: "success" },
  "admission.updated": { label: "Admissão editada", category: "admissoes", icon: "edit", tone: "neutral" },
  "admission.stage_changed": { label: "Etapa alterada", category: "admissoes", icon: "stage", tone: "info" },
  "admission.completed": { label: "Admissão concluída", category: "admissoes", icon: "done", tone: "success" },
  "admission.exam_updated": { label: "ASO atualizado", category: "admissoes", icon: "exam", tone: "info" },
  "admission.form_link_sent": { label: "Formulário enviado ao candidato", category: "admissoes", icon: "form-sent", tone: "info" },
  "admission.form_submitted": { label: "Formulário preenchido", category: "admissoes", icon: "form", tone: "success" },
  "admission.whatsapp_started": { label: "Admissão digital iniciada (WhatsApp)", category: "admissoes", icon: "whatsapp", tone: "info" },
  "admission.deleted": { label: "Admissão excluída", category: "admissoes", icon: "trash", tone: "danger" },

  "document.approved": { label: "Documento aprovado", category: "documentos", icon: "doc-ok", tone: "success" },
  "document.rejected": { label: "Documento recusado", category: "documentos", icon: "doc-bad", tone: "danger" },
  "document.review_undone": { label: "Revisão de documento desfeita", category: "documentos", icon: "undo", tone: "neutral" },

  "request.created": { label: "Solicitação criada", category: "solicitacoes", icon: "created", tone: "neutral" },
  "request.submitted": { label: "Solicitação enviada ao RH", category: "solicitacoes", icon: "send", tone: "info" },
  "request.updated": { label: "Solicitação editada", category: "solicitacoes", icon: "edit", tone: "neutral" },
  "request.hr_validated": { label: "Validada pelo RH", category: "solicitacoes", icon: "approve", tone: "info" },
  "request.returned": { label: "Solicitação devolvida", category: "solicitacoes", icon: "return", tone: "warning" },
  "request.approved": { label: "Vaga aprovada", category: "solicitacoes", icon: "approve", tone: "success" },
  "request.rejected": { label: "Vaga reprovada", category: "solicitacoes", icon: "reject", tone: "danger" },
  "request.cancelled": { label: "Solicitação cancelada", category: "solicitacoes", icon: "cancel", tone: "neutral" },
  "request.reopened": { label: "Solicitação reaberta", category: "solicitacoes", icon: "reopen", tone: "info" },
  "request.reapproval_required": { label: "Nova aprovação exigida", category: "solicitacoes", icon: "alert", tone: "warning" },
  "request.recruitment_started": { label: "Processo seletivo criado", category: "solicitacoes", icon: "job", tone: "success" },
  "request.other": { label: "Solicitação atualizada", category: "solicitacoes", icon: "edit", tone: "neutral" },

  "job.event": { label: "Vaga atualizada", category: "vagas", icon: "job", tone: "neutral" },
  "job.status": { label: "Status da vaga alterado", category: "vagas", icon: "job", tone: "info" },

  "candidate.stage_changed": { label: "Candidato movido de etapa", category: "candidatos", icon: "candidate", tone: "info" },

  "user.created": { label: "Usuário criado", category: "usuarios", icon: "user-plus", tone: "success" },
  "user.updated": { label: "Usuário editado", category: "usuarios", icon: "user", tone: "neutral" },
  "user.role_changed": { label: "Perfil alterado", category: "usuarios", icon: "shield", tone: "warning" },
  "user.deactivated": { label: "Usuário desativado", category: "usuarios", icon: "user-off", tone: "danger" },
  "user.reactivated": { label: "Usuário reativado", category: "usuarios", icon: "user-on", tone: "success" },
  "user.deleted": { label: "Usuário excluído", category: "usuarios", icon: "trash", tone: "danger" },

  "settings.changed": { label: "Configuração alterada", category: "configuracoes", icon: "settings", tone: "neutral" },
} satisfies Record<string, ActivityTypeDef>;

export type ActivityTypeKey = keyof typeof ACTIVITY_TYPES;

export function activityType(key: string): ActivityTypeDef {
  return (ACTIVITY_TYPES as Record<string, ActivityTypeDef>)[key] ?? {
    label: "Atividade registrada",
    category: "admissoes",
    icon: "edit",
    tone: "neutral",
  };
}

// ─── admission_activity_log.action → tipo ─────────────────────────────────────
// Códigos gravados pelo app (ver src/lib/activity/log.ts) e pelos fluxos antigos.

export const ADMISSION_LOG_ACTIONS: Record<string, ActivityTypeKey> = {
  ADMISSION_UPDATED: "admission.updated",
  STAGE_CHANGED: "admission.stage_changed",
  ADMISSION_COMPLETED: "admission.completed",
  EXAM_DATE_UPDATED: "admission.exam_updated",
  FORM_LINK_SENT: "admission.form_link_sent",
  FORM_SUBMITTED: "admission.form_submitted",
  ADMISSION_DIGITAL_COMPLETE: "admission.form_submitted",
  DIGITAL_ADMISSION_STARTED: "admission.whatsapp_started",
  ADMISSION_DELETED: "admission.deleted",
  DOC_APPROVED: "document.approved",
  DOC_REJECTED: "document.rejected",
  DOC_REVIEW_UNDONE: "document.review_undone",
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_ROLE_CHANGED: "user.role_changed",
  USER_DEACTIVATED: "user.deactivated",
  USER_REACTIVATED: "user.reactivated",
  USER_DELETED: "user.deleted",
};

/** Ações do log visíveis numa categoria (vazio = a categoria não usa essa fonte). */
export function logActionsFor(category: ActivityCategory | null): string[] {
  return Object.entries(ADMISSION_LOG_ACTIONS)
    .filter(([, key]) => !category || ACTIVITY_TYPES[key].category === category)
    .map(([action]) => action);
}

// ─── job_request_history.event → tipo ─────────────────────────────────────────
// O histórico grava tanto o id da ação ("APPROVE") quanto o nome no passado ("APPROVED").

const REQUEST_EVENTS: Record<string, ActivityTypeKey> = {
  CREATED: "request.created",
  SUBMIT: "request.submitted",
  SUBMITTED: "request.submitted",
  UPDATED: "request.updated",
  HR_VALIDATE: "request.hr_validated",
  HR_VALIDATED: "request.hr_validated",
  HR_RETURN: "request.returned",
  HR_RETURNED: "request.returned",
  APPROVER_RETURN: "request.returned",
  APPROVER_RETURNED: "request.returned",
  APPROVE: "request.approved",
  APPROVED: "request.approved",
  REJECT: "request.rejected",
  REJECTED: "request.rejected",
  CANCEL: "request.cancelled",
  CANCELLED: "request.cancelled",
  REOPEN: "request.reopened",
  REOPENED: "request.reopened",
  REAPPROVAL_REQUIRED: "request.reapproval_required",
  START_RECRUITMENT: "request.recruitment_started",
  RECRUITMENT_STARTED: "request.recruitment_started",
};

export function requestEventType(event: string): ActivityTypeKey {
  return REQUEST_EVENTS[event] ?? "request.other";
}

/** Tipos de job_events que não são ação de um usuário (migração de dados). */
export const HIDDEN_JOB_EVENTS = ["POSITIONS_MIGRATED"];

// ─── Formatação ──────────────────────────────────────────────────────────────

const TZ = "America/Sao_Paulo";

/** "21 set. · 19:51" (sem segundos) — listagem principal. */
export function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" }).replace(" de ", " ");
  const time = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}

/** "21/09/2026 às 19:51:07" — detalhe técnico completo. */
export function formatActivityTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: TZ })} às ${d.toLocaleTimeString("pt-BR", { timeZone: TZ })}`;
}

/** Chave do dia no fuso de São Paulo ("2026-09-21"), para agrupar a timeline. */
export function activityDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

/** "Hoje", "Ontem" ou "segunda-feira, 21 de setembro". */
export function activityDayLabel(key: string, now: Date = new Date()): string {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const yesterday = new Date(now.getTime() - 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
  if (key === today) return "Hoje";
  if (key === yesterday) return "Ontem";
  const d = new Date(`${key}T12:00:00Z`);
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Chave de ordenação com precisão de microssegundos: o Postgres guarda µs e o JS só ms.
 * Timestamps vindos do PostgREST ("2026-09-21T20:25:37.056123+00:00") são normalizados
 * para "2026-09-21T20:25:37.056123" em UTC — comparáveis como string.
 */
export function timestampSortKey(raw: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(raw.trim());
  if (!m) return new Date(raw).toISOString().replace("Z", "000");
  const [, date, time, frac = "", tz = "Z"] = m;
  if (tz === "Z" || /^[+-]00(:?00)?$/.test(tz)) return `${date}T${time}.${(frac + "000000").slice(0, 6)}`;
  // Offset diferente de UTC (raro): converte pelo Date e preserva os µs.
  const ms = new Date(`${date}T${time}${tz.length === 3 ? `${tz}:00` : tz}`).toISOString().slice(0, 19);
  return `${ms}.${(frac + "000000").slice(0, 6)}`;
}
