"use server";

// Server actions dos Modelos de Checklist (templates por cargo). Config = ADMIN_RH.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionConfig } from "./permissions";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const PATH = "/admissoes/configuracoes/modelos";

async function ensureConfig(): Promise<{ userId: string } | { error: string }> {
  const a = await requireAdmissionConfig();
  if (!a.ok) return { error: a.status === 401 ? "Não autenticado." : "Sem permissão." };
  return { userId: a.userId };
}

export async function createTemplate(name: string, positionId: string | null): Promise<CreateResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome do modelo." };

  const supabase = await createClient();
  const { data: tpl, error } = await supabase
    .from("admission_checklist_templates")
    .insert({ name: clean, positionId: positionId || null, createdById: auth.userId })
    .select("id")
    .single();
  if (error || !tpl) return { ok: false, error: "Erro ao criar modelo." };

  revalidatePath(PATH);
  return { ok: true, id: tpl.id };
}

export async function updateTemplate(
  id: string,
  patch: { name?: string; positionId?: string | null }
): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };

  const data: { name?: string; positionId?: string | null } = {};
  if (patch.name !== undefined) {
    const clean = patch.name.trim().slice(0, 120);
    if (!clean) return { ok: false, error: "Informe o nome do modelo." };
    data.name = clean;
  }
  if (patch.positionId !== undefined) data.positionId = patch.positionId || null;

  const supabase = await createClient();
  await supabase.from("admission_checklist_templates").update(data).eq("id", id);
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const supabase = await createClient();
  await supabase.from("admission_checklist_templates").delete().eq("id", id);
  revalidatePath(PATH);
  return { ok: true };
}

export async function addTemplateGroup(templateId: string, name: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome do grupo." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("admission_template_groups")
    .select("sortOrder")
    .eq("templateId", templateId)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("admission_template_groups").insert({
    templateId,
    name: clean,
    sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
  });
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTemplateGroup(groupId: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const supabase = await createClient();
  await supabase.from("admission_template_groups").delete().eq("id", groupId);
  revalidatePath(PATH);
  return { ok: true };
}

export async function addTemplateItem(groupId: string, name: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim().slice(0, 200);
  if (!clean) return { ok: false, error: "Informe o nome do item." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("admission_template_items")
    .select("sortOrder")
    .eq("groupId", groupId)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("admission_template_items").insert({
    groupId,
    name: clean,
    sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
  });
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTemplateItem(itemId: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const supabase = await createClient();
  await supabase.from("admission_template_items").delete().eq("id", itemId);
  revalidatePath(PATH);
  return { ok: true };
}
