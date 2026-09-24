// Histórico da admissão — módulo PURO. Junta só fontes REAIS:
//   • admissions.createdAt/createdById ............ admissão criada
//   • admission_attachments ....................... documentos enviados (agrupados por lote)
//   • admission_activity_log ...................... etapa, edições (de → para), ASO, formulário,
//                                                   revisão de documentos
// Ações do log sem tipo no catálogo de Atividades (diagnóstico do bot etc.) não aparecem —
// mesma regra da página Atividades. Nada é simulado.

import { ADMISSION_LOG_ACTIONS, activityType, type ActivityIcon } from "@/lib/activity/catalog";
import type { Tone } from "@/components/ui/StatusBadge";

export interface HistoryItem {
  id: string;
  at: string; // ISO
  title: string;
  description?: string;
  icon: ActivityIcon;
  tone: Tone;
}

export interface HistoryLogRow {
  id: number | string;
  action: string;
  description: string | null;
  metadata: unknown;
  createdAt: string;
  userName: string | null;
}

export interface HistoryAttachment {
  id: string;
  createdAt: string; // ISO
  uploadedByName: string | null;
  label: string; // tipo do documento ou nome do arquivo
}

export interface HistoryInput {
  createdAt: string;
  createdByName: string | null;
  digitalFormSubmittedAt: string | null;
  attachments: HistoryAttachment[];
  logs: HistoryLogRow[];
}

/** Envios do mesmo autor com até 10 min de diferença viram um único evento. */
const ATTACHMENT_BATCH_MS = 10 * 60_000;

type Change = { label?: string; from?: string | null; to?: string | null };

function meta(m: unknown): { from?: string | null; to?: string | null; changes?: Change[]; automatic?: boolean; trigger?: string } {
  return m && typeof m === "object" ? (m as { from?: string; to?: string; changes?: Change[]; automatic?: boolean; trigger?: string }) : {};
}

const q = (v: string | null | undefined) => (v ? `“${v}”` : "vazio");

function logToItem(log: HistoryLogRow): HistoryItem | null {
  const key = ADMISSION_LOG_ACTIONS[log.action];
  if (!key) return null;
  const type = activityType(key);
  const who = log.userName;
  const m = meta(log.metadata);
  const base = { id: `log-${log.id}`, at: new Date(log.createdAt).toISOString(), icon: type.icon, tone: type.tone };

  switch (key) {
    case "admission.stage_changed":
    case "admission.completed":
      return {
        ...base,
        title:
          key === "admission.completed"
            ? who ? `${who} concluiu a admissão` : "Admissão concluída"
            : m.automatic
              ? m.trigger === "submit"
                ? "Etapa alterada automaticamente (formulário enviado)"
                : "Etapa alterada automaticamente (candidato enviou documentos)"
              : who ? `${who} alterou a etapa` : "Etapa alterada",
        description: m.from !== undefined || m.to !== undefined ? `${q(m.from)} → ${q(m.to)}` : (log.description ?? undefined),
      };
    case "admission.updated": {
      const changes = (m.changes ?? []).filter((c) => c.label);
      return {
        ...base,
        title: who ? `${who} editou a admissão` : "Admissão editada",
        description: changes.length
          ? changes.map((c) => `${c.label}: ${q(c.from)} → ${q(c.to)}`).join(" · ")
          : (log.description ?? undefined),
      };
    }
    case "admission.exam_updated":
      return { ...base, title: who ? `${who} atualizou o ASO` : "ASO atualizado", description: log.description ?? undefined };
    case "admission.form_link_sent":
      return {
        ...base,
        title: who ? `${who} gerou o link do formulário de admissão` : "Link do formulário de admissão gerado",
        description: log.description?.includes("invalidado") ? "O link anterior foi invalidado." : undefined,
      };
    case "admission.form_submitted":
      return { ...base, title: "Candidato concluiu o formulário de admissão" };
    default:
      return {
        ...base,
        title: log.description ?? type.label,
        description: who ? `Por ${who}` : undefined,
      };
  }
}

export function buildAdmissionHistory(input: HistoryInput): HistoryItem[] {
  const items: HistoryItem[] = [
    {
      id: "created",
      at: new Date(input.createdAt).toISOString(),
      title: input.createdByName ? `${input.createdByName} criou a admissão` : "Admissão criada",
      icon: "created",
      tone: "success",
    },
  ];

  const logItems = input.logs.map(logToItem).filter((i): i is HistoryItem => i !== null);
  items.push(...logItems);

  // Formulários antigos (antes do log FORM_SUBMITTED) só têm a data gravada na admissão.
  const submittedLogged = input.logs.some((l) => ADMISSION_LOG_ACTIONS[l.action] === "admission.form_submitted");
  if (input.digitalFormSubmittedAt && !submittedLogged) {
    items.push({
      id: "form",
      at: new Date(input.digitalFormSubmittedAt).toISOString(),
      title: "Candidato concluiu o formulário de admissão",
      icon: "form",
      tone: "success",
    });
  }

  const byTime = [...input.attachments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let group: HistoryAttachment[] = [];
  const flush = () => {
    if (group.length === 0) return;
    const who = group[0].uploadedByName;
    const n = group.length;
    items.push({
      id: `att-${group[0].id}`,
      at: new Date(group[n - 1].createdAt).toISOString(),
      title: who ? `${who} enviou ${n === 1 ? "1 documento" : `${n} documentos`}` : n === 1 ? "1 documento recebido" : `${n} documentos recebidos`,
      description: group.map((g) => g.label).join(", "),
      icon: "created",
      tone: "info",
    });
    group = [];
  };
  for (const a of byTime) {
    const prev = group[group.length - 1];
    if (prev && (prev.uploadedByName !== a.uploadedByName || new Date(a.createdAt).getTime() - new Date(prev.createdAt).getTime() > ATTACHMENT_BATCH_MS)) {
      flush();
    }
    group.push(a);
  }
  flush();

  return items.sort((a, b) => b.at.localeCompare(a.at));
}
