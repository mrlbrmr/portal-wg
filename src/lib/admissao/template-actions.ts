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

/** Duplica um modelo inteiro (cabeçalho + grupos + itens), preservando a ordem. */
export async function duplicateTemplate(id: string): Promise<CreateResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: tpl } = await supabase
    .from("admission_checklist_templates")
    .select(
      "name, description, positionId, groups:admission_template_groups(name, sortOrder, items:admission_template_items(name, description, sortOrder, defaultDaysFromStart))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!tpl) return { ok: false, error: "Modelo não encontrado." };

  const source = tpl as unknown as {
    name: string;
    description: string | null;
    positionId: string | null;
    groups: Array<{
      name: string;
      sortOrder: number;
      items: Array<{
        name: string;
        description: string | null;
        sortOrder: number;
        defaultDaysFromStart: number | null;
      }>;
    }>;
  };

  const { data: last } = await supabase
    .from("admission_checklist_templates")
    .select("sortOrder")
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newTpl, error } = await supabase
    .from("admission_checklist_templates")
    .insert({
      name: `${source.name} (cópia)`.slice(0, 120),
      description: source.description ?? null,
      positionId: source.positionId ?? null,
      createdById: auth.userId,
      sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error || !newTpl) return { ok: false, error: "Erro ao duplicar modelo." };

  const groups = [...(source.groups ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const g of groups) {
    const { data: newGroup } = await supabase
      .from("admission_template_groups")
      .insert({ templateId: newTpl.id, name: g.name, sortOrder: g.sortOrder })
      .select("id")
      .single();
    if (!newGroup) continue;
    const items = [...(g.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    if (items.length > 0) {
      await supabase.from("admission_template_items").insert(
        items.map((it) => ({
          groupId: newGroup.id,
          name: it.name,
          description: it.description ?? null,
          sortOrder: it.sortOrder,
          defaultDaysFromStart: it.defaultDaysFromStart ?? null,
        }))
      );
    }
  }

  revalidatePath(PATH);
  return { ok: true, id: newTpl.id };
}

/** Reordena os modelos: grava a posição (1..n) na ordem recebida. */
export async function reorderTemplates(orderedIds: string[]): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { ok: true };

  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, idx) =>
      supabase.from("admission_checklist_templates").update({ sortOrder: idx + 1 }).eq("id", id)
    )
  );
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

/** Duplica uma seção (grupo + itens) dentro do mesmo modelo, ao final da lista. */
export async function duplicateTemplateGroup(groupId: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("admission_template_groups")
    .select(
      "id, templateId, name, items:admission_template_items(name, description, sortOrder, defaultDaysFromStart)"
    )
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Seção não encontrada." };

  const src = group as unknown as {
    templateId: string;
    name: string;
    items: Array<{
      name: string;
      description: string | null;
      sortOrder: number;
      defaultDaysFromStart: number | null;
    }>;
  };

  const { data: last } = await supabase
    .from("admission_template_groups")
    .select("sortOrder")
    .eq("templateId", src.templateId)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newGroup } = await supabase
    .from("admission_template_groups")
    .insert({
      templateId: src.templateId,
      name: `${src.name} (cópia)`.slice(0, 120),
      sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
    })
    .select("id")
    .single();
  if (!newGroup) return { ok: false, error: "Erro ao duplicar seção." };

  const items = [...(src.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  if (items.length > 0) {
    await supabase.from("admission_template_items").insert(
      items.map((it) => ({
        groupId: newGroup.id,
        name: it.name,
        description: it.description ?? null,
        sortOrder: it.sortOrder,
        defaultDaysFromStart: it.defaultDaysFromStart ?? null,
      }))
    );
  }

  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Move uma seção inteira (grupo + itens) para outro modelo. Como os itens
 * referenciam o grupo, basta reapontar o templateId do grupo — os itens seguem.
 */
export async function moveTemplateGroupToTemplate(
  groupId: string,
  targetTemplateId: string
): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!groupId || !targetTemplateId) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("admission_template_groups")
    .select("id, templateId")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Seção não encontrada." };
  if (group.templateId === targetTemplateId) return { ok: true }; // já está nesse modelo

  const { data: target } = await supabase
    .from("admission_checklist_templates")
    .select("id")
    .eq("id", targetTemplateId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Modelo de destino não encontrado." };

  const { data: last } = await supabase
    .from("admission_template_groups")
    .select("sortOrder")
    .eq("templateId", targetTemplateId)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("admission_template_groups")
    .update({
      templateId: targetTemplateId,
      sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
    })
    .eq("id", groupId);

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
