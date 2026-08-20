import type { AdmissionInput } from "./validation";

/** Converte "AAAA-MM-DD" (ou null) em Date à meia-noite, sem depender do fuso. */
function toDate(s?: string | null): Date | null {
  return s ? new Date(`${s}T00:00:00`) : null;
}

// Dados de escrita de uma admissão (campos idênticos para create e update; id,
// createdById e updatedById são preenchidos pela rota). Timestamps como Date —
// o supabase-js serializa para ISO no corpo JSON.
export interface AdmissionWriteData {
  fullName: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  positionId: string | null;
  companyId: string | null;
  branchId: string | null;
  stageId: string | null;
  responsibleId: string | null;
  managerName: string | null;
  startDate: Date | null;
  medicalExamDate: Date | null;
  salary: number | string | null;
  shift: string | null;
  uniformShirt: string | null;
  uniformPants: string | null;
  uniformShoe: string | null;
  notes: string | null;
  sourceApplicationId: string | null;
  sourceJobId: string | null;
}

/**
 * Traduz o input validado do formulário nos dados de escrita da admissão.
 * Serve tanto para create quanto para update (os campos são idênticos).
 */
export function admissionInputToData(input: AdmissionInput): AdmissionWriteData {
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
    sourceApplicationId: input.sourceApplicationId ?? null,
    sourceJobId: input.sourceJobId ?? null,
  };
}
