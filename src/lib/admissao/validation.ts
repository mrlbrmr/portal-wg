import { z } from "zod";
import { isValidCpf } from "@/lib/cpf";

// Normaliza strings vazias vindas de <input>/<select> para null.
const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optStr = (max = 255) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable().optional());

const optId = z.preprocess(emptyToNull, z.string().max(64).nullable().optional());

const optDate = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)")
    .nullable()
    .optional()
);

const optSalary = z.preprocess(
  emptyToNull,
  z
    .union([z.number(), z.string().regex(/^\d+([.,]\d{1,2})?$/, "Salário inválido")])
    .nullable()
    .optional()
);

// Schema de criação/edição de uma admissão. Todos os campos são opcionais
// exceto o nome. IDs de configuração e datas chegam como string do formulário.
export const admissionSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo").max(120),
  cpf: z.preprocess(
    emptyToNull,
    z.string().max(14).refine(isValidCpf, "CPF inválido").nullable().optional()
  ),
  email: z.preprocess(
    emptyToNull,
    z.string().email("E-mail inválido").max(150).nullable().optional()
  ),
  phone: optStr(20),
  birthDate: optDate,
  positionId: optId,
  companyId: optId,
  branchId: optId,
  stageId: optId,
  templateId: optId,
  responsibleId: optId,
  managerName: optStr(120),
  startDate: optDate,
  medicalExamDate: optDate,
  salary: optSalary,
  shift: optStr(60),
  uniformShirt: optStr(20),
  uniformPants: optStr(20),
  uniformShoe: optStr(20),
  notes: optStr(5000),
});

export type AdmissionInput = z.infer<typeof admissionSchema>;
