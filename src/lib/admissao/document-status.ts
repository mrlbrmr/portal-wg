// Estado de cada documento admissional, derivado do que o banco registra:
// existência do anexo + validação automática por IA (aiStatus/aiReason) + revisão manual do
// RH (reviewStatus/reviewReason). A decisão humana SEMPRE prevalece sobre o parecer da IA.

export type AiStatus = "pending" | "approved" | "needs_review" | "rejected";
export type ReviewStatus = "approved" | "rejected";

export type DocumentStatus =
  | "PENDING"
  | "OPTIONAL_EMPTY"
  | "SENT"
  | "IN_REVIEW"
  | "AI_APPROVED"
  | "NEEDS_REVIEW"
  | "AI_REJECTED"
  | "HR_APPROVED"
  | "HR_REJECTED";

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
  HR_APPROVED: { label: "Aprovado", tone: "success", hint: "Aprovado manualmente pelo RH" },
  HR_REJECTED: { label: "Recusado", tone: "danger", hint: "Recusado manualmente pelo RH — peça um novo envio" },
};

export interface FileStatusInput {
  aiStatus?: string | null;
  reviewStatus?: string | null;
}

export function fileStatus(f: FileStatusInput): DocumentStatus {
  if (f.reviewStatus === "approved") return "HR_APPROVED";
  if (f.reviewStatus === "rejected") return "HR_REJECTED";
  switch (f.aiStatus) {
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

/** Precisa de ação do RH (conferir ou pedir novo envio). */
export function needsAttention(status: DocumentStatus): boolean {
  return status === "NEEDS_REVIEW" || status === "AI_REJECTED" || status === "HR_REJECTED";
}

/** Estado da categoria = estado do arquivo mais recente (ou pendente, se não há arquivo). */
export function sectionStatus(files: Array<FileStatusInput & { createdAt: string }>, required: boolean): DocumentStatus {
  if (files.length === 0) return required ? "PENDING" : "OPTIONAL_EMPTY";
  const latest = [...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return fileStatus(latest);
}
