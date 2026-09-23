// Regras dos CAMPOS ADICIONAIS da solicitação de vaga (perguntas complementares).
// Módulo PURO: usado pelo formulário (público e interno), pela API, pelo editor nas
// Configurações e pela tela da solicitação — uma regra só para todos.

import { z } from "zod";
import type { FieldType, FormFieldConfig, ShowCondition } from "@/types/form-config";

export const FIELD_TYPES: FieldType[] = ["text", "textarea", "select", "multiselect", "boolean", "number", "date", "email"];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  select: "Seleção",
  multiselect: "Múltipla escolha",
  boolean: "Sim / Não",
  number: "Número",
  date: "Data",
  email: "E-mail",
};

export const BOOLEAN_OPTIONS = ["Sim", "Não"] as const;

/** Tipos com lista de opções definida pelo RH. */
export function hasOptions(type: FieldType): boolean {
  return type === "select" || type === "multiselect";
}

/** Tipos que podem controlar a exibição de outros campos (condição "SE … ENTÃO"). */
export function canBeConditionSource(field: FormFieldConfig): boolean {
  if (field.type === "boolean") return true;
  return hasOptions(field.type) && (field.options?.length ?? 0) > 0;
}

/** Valores possíveis de um campo-fonte de condição. */
export function conditionValues(field: FormFieldConfig): string[] {
  return field.type === "boolean" ? [...BOOLEAN_OPTIONS] : field.options ?? [];
}

/** Lê a resposta de múltipla escolha (JSON de string[]). Tolera texto solto legado. */
export function parseMulti(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [raw];
  } catch {
    return [raw];
  }
}

export function serializeMulti(values: string[]): string {
  return values.length ? JSON.stringify(values) : "";
}

export function evaluateCondition(
  c: ShowCondition,
  values: Record<string, string>,
  fields: FormFieldConfig[]
): boolean {
  const source = fields.find((f) => f.key === c.fieldKey);
  const raw = (values[c.fieldKey] ?? "").trim();
  const matches = source?.type === "multiselect" ? parseMulti(raw).includes(c.value) : raw === c.value;
  if (c.operator === "is") return matches;
  if (c.operator === "is_not") return !matches;
  return true;
}

/** O campo aparece com as respostas atuais? (condições em cadeia também valem). */
export function isFieldVisible(
  field: FormFieldConfig,
  values: Record<string, string>,
  fields: FormFieldConfig[],
  depth = 0
): boolean {
  if (!field.showWhen) return true;
  if (depth > 10) return true; // proteção contra ciclo
  const source = fields.find((f) => f.key === field.showWhen!.fieldKey);
  if (source && !isFieldVisible(source, values, fields, depth + 1)) return false;
  return evaluateCondition(field.showWhen, values, fields);
}

function isEmpty(field: FormFieldConfig, raw: string | undefined): boolean {
  if (field.type === "multiselect") return parseMulti(raw).length === 0;
  return !(raw ?? "").trim();
}

/**
 * Erros das perguntas complementares: obrigatórias e VISÍVEIS sem resposta.
 * Um campo condicional escondido nunca bloqueia o envio.
 */
export function validateExtraData(
  fields: FormFieldConfig[],
  values: Record<string, string>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!field.required || !isFieldVisible(field, values, fields)) continue;
    if (isEmpty(field, values[field.key])) errors[field.key] = `${field.label} é obrigatório`;
  }
  return errors;
}

/** Resposta pronta para exibir na tela da solicitação. */
export function formatExtraValue(field: FormFieldConfig, raw: string | undefined | null): string | null {
  if (!raw) return null;
  if (field.type === "multiselect") return parseMulti(raw).join(", ") || null;
  if (field.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}/${m}/${y}`;
  }
  return raw;
}

// ─── Validação da configuração (editor nas Configurações) ─────────────────────

const conditionSchema = z.object({
  fieldKey: z.string().min(1).max(80),
  operator: z.enum(["is", "is_not"]),
  value: z.string().max(200),
});

export const formFieldSchema = z.object({
  id: z.string().min(1).max(40),
  key: z.string().min(1).max(80),
  label: z.string().trim().min(1, "Toda pergunta precisa de um nome.").max(200),
  type: z.enum(["text", "textarea", "select", "multiselect", "boolean", "number", "date", "email"]),
  required: z.boolean(),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(300).optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  showWhen: conditionSchema.optional(),
});

export const jobRequestFormConfigSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título do formulário.").max(160),
    description: z.string().max(1000).default(""),
    fields: z.array(formFieldSchema).max(60),
  })
  .superRefine((cfg, ctx) => {
    const keys = new Set<string>();
    for (const f of cfg.fields) {
      if (keys.has(f.key)) ctx.addIssue({ code: "custom", message: "Há perguntas com a mesma chave interna." });
      keys.add(f.key);
      if (hasOptions(f.type) && (f.options?.length ?? 0) === 0) {
        ctx.addIssue({ code: "custom", message: `Adicione ao menos uma opção em “${f.label}”.` });
      }
      if (f.showWhen && !cfg.fields.some((o) => o.key === f.showWhen!.fieldKey && o.id !== f.id)) {
        ctx.addIssue({ code: "custom", message: `A condição de “${f.label}” aponta para uma pergunta que não existe mais.` });
      }
    }
  });
