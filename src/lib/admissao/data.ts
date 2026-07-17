import type { Prisma } from "@prisma/client";
import type { AdmissionInput } from "./validation";

/** Converte "AAAA-MM-DD" (ou null) em Date à meia-noite, sem depender do fuso. */
function toDate(s?: string | null): Date | null {
  return s ? new Date(`${s}T00:00:00`) : null;
}

/**
 * Traduz o input validado do formulário nos dados de escrita do Prisma.
 * Serve tanto para create quanto para update (os campos são idênticos).
 */
export function admissionInputToData(
  input: AdmissionInput
): Omit<Prisma.AdmissionUncheckedCreateInput, "id" | "createdById" | "updatedById"> {
  return {
    fullName: input.fullName,
    cpf: input.cpf ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    birthDate: toDate(input.birthDate),
    positionId: input.positionId ?? null,
    companyId: input.companyId ?? null,
    branchId: input.branchId ?? null,
    stageId: input.stageId ?? null,
    templateId: input.templateId ?? null,
    responsibleId: input.responsibleId ?? null,
    managerName: input.managerName ?? null,
    startDate: toDate(input.startDate),
    medicalExamDate: toDate(input.medicalExamDate),
    salary:
      input.salary == null
        ? null
        : typeof input.salary === "number"
          ? input.salary
          : input.salary.replace(",", "."),
    shift: input.shift ?? null,
    uniformShirt: input.uniformShirt ?? null,
    uniformPants: input.uniformPants ?? null,
    uniformShoe: input.uniformShoe ?? null,
    notes: input.notes ?? null,
  };
}
