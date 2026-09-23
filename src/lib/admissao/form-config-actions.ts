"use server";

// Server action do editor do formulário de admissão digital. Config = ADMIN_RH.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionConfig } from "./permissions";
import { FormConfigSchema, type FormConfig } from "./form-config";
import { logConfigChange } from "@/lib/settings/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveFormConfig(raw: unknown): Promise<ActionResult> {
  const a = await requireAdmissionConfig();
  if (!a.ok) return { ok: false, error: a.status === 401 ? "Não autenticado." : "Sem permissão." };

  const parsed = FormConfigSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: describeIssue(parsed.error.issues[0]?.path ?? []) };

  const config = parsed.data as FormConfig;

  // Garante ao menos um documento e chaves de documento únicas.
  const keys = config.documents.map((d) => d.key.trim());
  if (new Set(keys).size !== keys.length)
    return { ok: false, error: "Há documentos com a mesma chave (key). Use chaves únicas." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admission_form_config")
    .upsert({ id: "default", config, updatedById: a.userId, updatedAt: new Date().toISOString() });

  if (error) {
    console.error("[form-config-save]", error);
    return { ok: false, error: "Erro ao salvar. Tente novamente." };
  }

  await logConfigChange(a.session, "formulario-admissao", "Formulário de Admissão Digital atualizado");
  revalidatePath("/configuracoes/formulario-admissao");
  return { ok: true };
}

const OPTION_LISTS: Record<string, string> = {
  genderOptions: "Opções de gênero",
  maritalOptions: "Opções de estado civil",
  colorOptions: "Opções de autodeclaração de cor",
};

/** Mensagem legível para o primeiro problema de validação da configuração. */
function describeIssue(path: Array<string | number>): string {
  const [root, index, field] = path;
  if (root === "documents" && typeof index === "number") {
    if (field === "label") return `Documento ${index + 1}: informe o nome.`;
    if (field === "extraFields") return `Documento ${index + 1}: revise os campos de texto (rótulo e chave).`;
    return `Documento ${index + 1}: revise os dados.`;
  }
  if (root === "documents") return "Mantenha ao menos um documento no formulário.";
  if (typeof root === "string" && OPTION_LISTS[root]) return `${OPTION_LISTS[root]}: não deixe opções vazias.`;
  return "Revise os campos: algum texto está vazio ou longo demais.";
}
