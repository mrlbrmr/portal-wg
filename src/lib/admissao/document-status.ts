// Estado de cada documento admissional, derivado do que o banco JÁ registra:
// existência do anexo + validação automática por IA (admission_attachments.aiStatus/aiReason).
//
// Aprovação/recusa MANUAL pelo RH (com motivo e "solicitar novamente") ainda não existe no
// backend — exigiria colunas novas (ex.: reviewStatus, reviewedById, reviewedAt,
// rejectionReason). Até lá, a UI deixa claro quando o parecer é da IA.

export type AiStatus = "pending" | "approved" | "needs_review" | "rejected";

export type DocumentStatus = "PENDING" | "OPTIONAL_EMPTY" | "SENT" | "IN_REVIEW" | "AI_APPROVED" | "NEEDS_REVIEW" | "AI_REJECTED";

export const DOCUMENT_STATUS_META: Record<
  DocumentStatus,
  { label: string; tone: "success" | "info" | "warning" | "danger" | "neutral"; hint: string }
> = {
  PENDING: { label: "Pendente", tone: "warning", hint: "Documento obrigatório ainda não enviado" },
  OPTIONAL_EMPTY: { label: "Não enviado", tone: "neutral", hint: "Documento opcional" },
  SENT: { label: "Enviado", tone: "info", hint: "Arquivo recebido, sem validação automática" },
  IN_REVIEW: { label: "Em análise", tone: "info", hint: "Validação automática em andamento" },
  AI_APPROVED: { label: "Validado pela IA", tone: "success", hint: "A validação automática não encontrou problemas" },
  NEEDS_REVIEW: { label: "Revisar", tone: "warning", hint: "A validação automática pediu conferência humana" },
  AI_REJECTED: { label: "Recusado pela IA", tone: "danger", hint: "A validação automática encontrou um problema" },
};

export function fileStatus(aiStatus: string | null | undefined): DocumentStatus {
  switch (aiStatus) {
    case "pending":
      return "IN_REVIEW";
    case "approved":
      return "AI_APPROVED";
    case "needs_review":
      return "NEEDS_REVIEW";
    case "rejected":
      return "AI_REJECTED";
    default:
      return "SENT";
  }
}

/** Estado da categoria = estado do arquivo mais recente (ou pendente, se não há arquivo). */
export function sectionStatus(
  files: Array<{ createdAt: string; aiStatus?: string | null }>,
  required: boolean
): DocumentStatus {
  if (files.length === 0) return required ? "PENDING" : "OPTIONAL_EMPTY";
  const latest = [...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return fileStatus(latest.aiStatus);
}
