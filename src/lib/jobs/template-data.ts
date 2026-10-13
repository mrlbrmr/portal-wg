import "server-only";

// Leitura dos modelos de vaga (RLS: staff lê). Falha de leitura nunca derruba a tela da
// vaga — sem modelos, o seletor simplesmente não aparece.

import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_SELECT_COLUMNS, type JobTemplate } from "./templates";

export async function loadJobTemplates(): Promise<JobTemplate[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("job_templates")
      .select(TEMPLATE_SELECT_COLUMNS)
      .order("name", { ascending: true });
    if (error) {
      console.warn("[job-templates]", error.message);
      return [];
    }
    return (data ?? []) as unknown as JobTemplate[];
  } catch (e) {
    console.warn("[job-templates]", e);
    return [];
  }
}
