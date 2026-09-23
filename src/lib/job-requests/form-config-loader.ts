// Carrega o formulário de solicitação de vaga (linha única job_request_form_config#singleton).
// Server-only (usa o client service-role: o formulário também é lido pela página pública).

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import type { FormConfig } from "@/types/form-config";

export interface LoadedJobRequestFormConfig extends FormConfig {
  updatedAt: string | null;
}

export async function loadJobRequestFormConfig(): Promise<LoadedJobRequestFormConfig> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("job_request_form_config")
    .select("title, description, fields, updated_at")
    .eq("id", "singleton")
    .maybeSingle();

  if (!data) return { ...DEFAULT_FORM_CONFIG, updatedAt: null };
  return {
    title: data.title ?? DEFAULT_FORM_CONFIG.title,
    description: data.description ?? DEFAULT_FORM_CONFIG.description,
    fields: Array.isArray(data.fields) ? data.fields : DEFAULT_FORM_CONFIG.fields,
    updatedAt: (data.updated_at as string | null) ?? null,
  };
}
