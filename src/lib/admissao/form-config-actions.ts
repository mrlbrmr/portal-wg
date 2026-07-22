"use server";

// Server action do editor do formulário de admissão digital. Config = ADMIN_RH.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionConfig } from "./permissions";
import { FormConfigSchema, type FormConfig } from "./form-config";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveFormConfig(raw: unknown): Promise<ActionResult> {
  const a = await requireAdmissionConfig();
  if (!a.ok) return { ok: false, error: a.status === 401 ? "Não autenticado." : "Sem permissão." };

  const parsed = FormConfigSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Configuração inválida. Revise os campos." };

  const config = parsed.data as FormConfig;

  // Garante ao menos um documento e chaves de documento únicas.
  const keys = config.documents.map((d) => d.key.trim());
  if (new Set(keys).size !== keys.length)
    return { ok: false, error: "Há documentos com a mesma chave (key). Use chaves únicas." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admission_form_config")
    .upsert({ id: "default", config, updatedAt: new Date().toISOString() });

  if (error) {
    console.error("[form-config-save]", error);
    return { ok: false, error: "Erro ao salvar. Tente novamente." };
  }

  revalidatePath("/admissoes/configuracoes/formulario");
  return { ok: true };
}
