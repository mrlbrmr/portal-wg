// Leitura dos modelos de processo e das etapas efetivas de uma vaga (servidor).
// As regras de escolha/ordem ficam em ./process-templates.ts (puro, testado).

import { createClient } from "@/lib/supabase/server";
import { refsFromIds, type OrderedStageRef } from "./process-templates";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  active: boolean;
  /** Etapas do catálogo, na ordem do modelo. */
  stageIds: string[];
}

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  active: boolean;
}

interface TemplateStageRow {
  templateId: string;
  stageId: string;
  sortOrder: number;
}

export async function loadProcessTemplates(supabase?: Supabase): Promise<ProcessTemplate[]> {
  const db = supabase ?? (await createClient());
  const [{ data: templates }, { data: links }] = await Promise.all([
    db.from("process_templates").select("id, name, description, isDefault, active").order("name", { ascending: true }),
    db.from("process_template_stages").select("templateId, stageId, sortOrder"),
  ]);

  const byTemplate = new Map<string, TemplateStageRow[]>();
  for (const l of (links ?? []) as TemplateStageRow[]) {
    const list = byTemplate.get(l.templateId) ?? [];
    list.push(l);
    byTemplate.set(l.templateId, list);
  }

  return ((templates ?? []) as TemplateRow[])
    .map((t) => ({
      ...t,
      stageIds: (byTemplate.get(t.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder).map((l) => l.stageId),
    }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name, "pt-BR"));
}

/** Etapas do modelo padrão (null se não houver — o catálogo inteiro vale, como antes). */
export function defaultTemplateRefs(templates: ProcessTemplate[]): OrderedStageRef[] | null {
  const def = templates.find((t) => t.isDefault && t.active);
  return def && def.stageIds.length > 0 ? refsFromIds(def.stageIds) : null;
}

export async function loadDefaultTemplateRefs(supabase: Supabase): Promise<OrderedStageRef[] | null> {
  const { data: def } = await supabase
    .from("process_templates")
    .select("id")
    .eq("isDefault", true)
    .eq("active", true)
    .maybeSingle();
  if (!def) return null;
  const { data } = await supabase
    .from("process_template_stages")
    .select("stageId, sortOrder")
    .eq("templateId", def.id as string);
  const rows = (data ?? []) as Array<{ stageId: string; sortOrder: number }>;
  return rows.length > 0 ? rows : null;
}

/** Ajuste da própria vaga: linhas de job_stage_config (com ordem). */
export async function loadJobStageRefs(supabase: Supabase, jobId: string): Promise<OrderedStageRef[]> {
  const { data } = await supabase.from("job_stage_config").select("stageId, sortOrder").eq("jobId", jobId);
  return (data ?? []) as OrderedStageRef[];
}

/** Ajustes de todas as vagas de uma vez (listas que cruzam vagas). */
export async function loadAllJobStageRefs(supabase: Supabase): Promise<Map<string, OrderedStageRef[]>> {
  const { data } = await supabase.from("job_stage_config").select("jobId, stageId, sortOrder");
  const map = new Map<string, OrderedStageRef[]>();
  for (const r of (data ?? []) as Array<{ jobId: string; stageId: string; sortOrder: number }>) {
    const list = map.get(r.jobId) ?? [];
    list.push({ stageId: r.stageId, sortOrder: r.sortOrder });
    map.set(r.jobId, list);
  }
  return map;
}
