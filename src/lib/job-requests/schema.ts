// Contrato dos dados da solicitação — um schema só, usado pelo POST público
// (/api/job-requests), pela criação interna e pela edição. Client-safe.

import { z } from "zod";
import { ContractType, JobRequestReason, Modality } from "@/types/domain";

const optionalText = (max = 500) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ?? "").trim() || null);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .optional()
  .nullable()
  .transform((v) => v || null);

export const jobRequestPayloadSchema = z
  .object({
    // ── Dados da solicitação ──
    title: z.string().trim().min(2, "Informe o título da vaga"),
    department: z.string().trim().min(2, "Informe a área / departamento"),
    location: z.string().trim().min(2, "Informe a empresa / unidade"),
    requesterName: z.string().trim().min(2, "Informe o gestor requisitante"),
    requesterEmail: z.string().trim().email("Informe um e-mail válido"),
    openings: z.coerce.number().int().min(1, "A quantidade deve ser ao menos 1").max(999),

    // ── Motivo da contratação ──
    reasonType: z.nativeEnum(JobRequestReason),
    replacedEmployee: optionalText(200),
    justification: z.string().trim().min(10, "Descreva a justificativa da contratação"),
    desiredStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data desejada para admissão"),

    // ── Condições da vaga ──
    // O gestor NÃO informa faixa salarial, centro de custo nem previsão de orçamento:
    // a WG não usa centro de custo, o salário é definido pelo RH direto na vaga e o
    // headcount é controlado fora do sistema. As colunas salary_min/salary_max/
    // cost_center/budget_status seguem no banco, reservadas e sem uso pela aplicação.
    contractType: z.nativeEnum(ContractType),
    modality: z.nativeEnum(Modality),
    workSchedule: optionalText(200),

    /** Perguntas complementares configuradas em /configuracoes/formulario-vaga. */
    extraData: z.record(z.string()).optional().default({}),
  })
  .superRefine((data, ctx) => {
    // "Substituição" é o único motivo que exige o colaborador substituído.
    if (data.reasonType === "REPLACEMENT" && !data.replacedEmployee) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["replacedEmployee"],
        message: "Informe o colaborador substituído",
      });
    }
  });

export type JobRequestPayload = z.infer<typeof jobRequestPayloadSchema>;

/** Campos que o solicitante pode salvar como rascunho sem passar pela validação completa. */
export const jobRequestDraftSchema = z.object({
  title: optionalText(200),
  department: optionalText(120),
  location: optionalText(120),
  requesterName: optionalText(200),
  requesterEmail: optionalText(200),
  openings: z.coerce.number().int().min(1).max(999).optional().nullable(),
  reasonType: z.nativeEnum(JobRequestReason).optional().default("OTHER"),
  replacedEmployee: optionalText(200),
  justification: optionalText(4000),
  desiredStartDate: isoDate,
  contractType: z.nativeEnum(ContractType).optional().nullable(),
  modality: z.nativeEnum(Modality).optional().nullable(),
  workSchedule: optionalText(200),
  extraData: z.record(z.string()).optional().default({}),
});

export type JobRequestDraft = z.infer<typeof jobRequestDraftSchema>;

/**
 * Campos da solicitação em uma forma frouxa — o payload completo e o rascunho divergem
 * na nulidade de quase tudo, e `payloadToColumns` aceita os dois.
 */
export type JobRequestColumnsInput = {
  [K in keyof JobRequestPayload]?: JobRequestPayload[K] | null;
};

/** Colunas do banco correspondentes ao payload (snake_case). */
export function payloadToColumns(data: JobRequestColumnsInput): Record<string, unknown> {
  return {
    title: data.title ?? null,
    department: data.department ?? null,
    location: data.location ?? null,
    requester_name: data.requesterName ?? null,
    requester_email: data.requesterEmail ?? null,
    openings: data.openings ?? null,
    reason_type: data.reasonType ?? "OTHER",
    replaced_employee: data.reasonType === "REPLACEMENT" ? (data.replacedEmployee ?? null) : null,
    justification: data.justification ?? null,
    desired_start_date: data.desiredStartDate ?? null,
    contract_type: data.contractType ?? null,
    modality: data.modality ?? null,
    work_schedule: data.workSchedule ?? null,
    extra_data: data.extraData ?? {},
  };
}
