// Validação do agendamento de entrevista. Client-safe: UI e API usam as mesmas regras.

import { z } from "zod";
import { firstIssue } from "@/lib/recruitment/evaluations/schema";
import { INTERVIEW_ROUND_CODES, type InterviewRoundCode } from "./catalog";

export interface ScheduleInput {
  applicationId: string;
  round: InterviewRoundCode;
  scheduledAt: string;
  durationMin: number;
  location: string | null;
  interviewerName: string | null;
  notes: string | null;
  allowPast: boolean;
}

const optionalText = (max: number, label: string) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .refine((v) => v.length <= max, `${label} deve ter no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const scheduleSchema = z.object({
  applicationId: z.string({ required_error: "Candidatura obrigatória." }).min(1, "Candidatura obrigatória."),
  round: z.enum(INTERVIEW_ROUND_CODES, { errorMap: () => ({ message: "Rodada inválida." }) }),
  scheduledAt: z
    .string({ required_error: "Informe a data e a hora." })
    .datetime({ message: "Data e hora inválidas." }),
  durationMin: z
    .number({ invalid_type_error: "Duração inválida." })
    .int("Duração inválida.")
    .min(5, "A duração mínima é de 5 minutos.")
    .max(480, "A duração máxima é de 8 horas.")
    .default(60),
  location: optionalText(500, "O local"),
  interviewerName: optionalText(120, "O nome do entrevistador"),
  notes: optionalText(2000, "As observações"),
  allowPast: z.boolean().optional().default(false),
});

export function parseScheduleInput(
  raw: unknown,
  now: Date = new Date(),
): { ok: true; value: ScheduleInput } | { ok: false; error: string } {
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const value = parsed.data as ScheduleInput;
  if (!value.allowPast && new Date(value.scheduledAt).getTime() <= now.getTime()) {
    return { ok: false, error: "A data da entrevista deve ser futura." };
  }
  return { ok: true, value };
}
