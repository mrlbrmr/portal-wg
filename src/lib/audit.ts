import { prisma } from "@/lib/prisma";

type AuditAction =
  | "JOB_CREATED"
  | "JOB_UPDATED"
  | "JOB_STATUS_CHANGED"
  | "APPLICATION_RECEIVED"
  | "APPLICATION_STATUS_CHANGED"
  | "AI_REVIEW_GENERATED"
  | "CANDIDATE_ANONYMIZED"
  | "RESUME_DOWNLOADED"
  | "USER_LOGIN"
  | "USER_LOGOUT";

interface AuditParams {
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userEmail: params.userEmail,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        // Metadados sem dados sensíveis do candidato
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    // Falha no log não deve bloquear a operação principal
    console.error("[Audit] Erro ao registrar log:", error);
  }
}
