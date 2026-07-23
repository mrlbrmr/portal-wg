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

// Cliente Supabase (server) tipado frouxo — usado nos helpers internos.
type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Substitui os cargos vinculados a um modelo (N:N). Vazio = "Todos os cargos". */
async function setTemplatePositions(
  supabase: SupabaseServer,
  templateId: string,
  positionIds: string[]
): Promise<void> {
  await supabase.from("admission_template_positions").delete().eq("templateId", templateId);
  const ids = [...new Set(positionIds.filter(Boolean))];
  if (ids.length > 0) {
    await supabase
      .from("admission_template_positions")
      .insert(ids.map((positionId) => ({ templateId, positionId })));
  }
}

export async function createTemplate(name: string, positionIds: string[]): Promise<CreateResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome do modelo." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("admission_checklist_templates")
    .select("sortOrder")
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: tpl, error } = await supabase
    .from("admission_checklist_templates")
    .insert({
      name: clean,
      createdById: auth.userId,
      sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error || !tpl) return { ok: false, error: "Erro ao criar modelo." };

  await setTemplatePositions(supabase, tpl.id, positionIds);

  revalidatePath(PATH);
  return { ok: true, id: tpl.id };
}

export async function updateTemplate(
  id: string,
  patch: { name?: string; positionIds?: string[] }
): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  if (patch.name !== undefined) {
    const clean = patch.name.trim().slice(0, 120);
    if (!clean) return { ok: false, error: "Informe o nome do modelo." };
    await supabase.from("admission_checklist_templates").update({ name: clean }).eq("id", id);
  }
  if (patch.positionIds !== undefined) {
    await setTemplatePositions(supabase, id, patch.positionIds);
  }
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
      "name, description, positions:admission_template_positions(positionId), groups:admission_template_groups(name, sortOrder, items:admission_template_items(id, name, description, sortOrder, defaultDaysFromStart, parentId))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!tpl) return { ok: false, error: "Modelo não encontrado." };

  const source = tpl as unknown as {
    name: string;
    description: string | null;
    positions: Array<{ positionId: string }>;
    groups: Array<{
      name: string;
      sortOrder: number;
      items: TemplateItemRow[];
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
      createdById: auth.userId,
      sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error || !newTpl) return { ok: false, error: "Erro ao duplicar modelo." };

  await setTemplatePositions(
    supabase,
    newTpl.id,
    (source.positions ?? []).map((p) => p.positionId)
  );

  const groups = [...(source.groups ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const g of groups) {
    const { data: newGroup } = await supabase
      .from("admission_template_groups")
      .insert({ templateId: newTpl.id, name: g.name, sortOrder: g.sortOrder })
      .select("id")
      .single();
    if (!newGroup) continue;
    await copyTemplateItemsIntoGroup(supabase, g.items, newGroup.id);
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
      "id, templateId, name, items:admission_template_items(id, name, description, sortOrder, defaultDaysFromStart, parentId)"
    )
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Seção não encontrada." };

  const src = group as unknown as {
    templateId: string;
    name: string;
    items: TemplateItemRow[];
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

  await copyTemplateItemsIntoGroup(supabase, src.items, newGroup.id);

  revalidatePath(PATH);
  return { ok: true };
}

interface TemplateItemRow {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  defaultDaysFromStart: number | null;
  parentId: string | null;
}

/**
 * Recria os itens de um grupo em outro grupo preservando a hierarquia de
 * subtarefas (itens de topo primeiro; depois as filhas reapontando o novo pai).
 */
async function copyTemplateItemsIntoGroup(
  supabase: SupabaseServer,
  items: TemplateItemRow[],
  newGroupId: string
): Promise<void> {
  const sorted = [...(items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const topLevel = sorted.filter((it) => !it.parentId);
  const children = sorted.filter((it) => it.parentId);
  const idMap = new Map<string, string>();

  for (const it of topLevel) {
    const { data: created } = await supabase
      .from("admission_template_items")
      .insert({
        groupId: newGroupId,
        name: it.name,
        description: it.description ?? null,
        sortOrder: it.sortOrder,
        defaultDaysFromStart: it.defaultDaysFromStart ?? null,
      })
      .select("id")
      .single();
    if (created) idMap.set(it.id, created.id);
  }

  const childRows = children
    .filter((it) => it.parentId && idMap.has(it.parentId))
    .map((it) => ({
      groupId: newGroupId,
      parentId: idMap.get(it.parentId!)!,
      name: it.name,
      description: it.description ?? null,
      sortOrder: it.sortOrder,
      defaultDaysFromStart: it.defaultDaysFromStart ?? null,
    }));
  if (childRows.length > 0) {
    await supabase.from("admission_template_items").insert(childRows);
  }
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
    .is("parentId", null)
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

/** Adiciona uma subtarefa (item filho) sob um item de modelo. Um nível só. */
export async function addTemplateSubtask(parentItemId: string, name: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim().slice(0, 200);
  if (!clean) return { ok: false, error: "Informe o nome da subtarefa." };

  const supabase = await createClient();
  const { data: parent } = await supabase
    .from("admission_template_items")
    .select("id, groupId, parentId")
    .eq("id", parentItemId)
    .maybeSingle();
  if (!parent) return { ok: false, error: "Item não encontrado." };
  if (parent.parentId) return { ok: false, error: "Subtarefas não podem ter subtarefas." };

  const { data: last } = await supabase
    .from("admission_template_items")
    .select("sortOrder")
    .eq("parentId", parentItemId)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("admission_template_items").insert({
    groupId: parent.groupId,
    parentId: parentItemId,
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

/** Renomeia um item de modelo. */
export async function renameTemplateItem(itemId: string, name: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim().slice(0, 200);
  if (!clean) return { ok: false, error: "Informe o nome do item." };
  const supabase = await createClient();
  await supabase.from("admission_template_items").update({ name: clean }).eq("id", itemId);
  revalidatePath(PATH);
  return { ok: true };
}

/** Reordena um item entre seus irmãos (mesmo grupo), trocando sortOrder. */
export async function moveTemplateItem(
  itemId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("admission_template_items")
    .select("groupId, parentId")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "Item não encontrado." };

  // Reordena só entre irmãos do mesmo escopo (mesmo pai, ou raiz do grupo).
  let q = supabase
    .from("admission_template_items")
    .select("id, sortOrder")
    .eq("groupId", item.groupId);
  q = item.parentId ? q.eq("parentId", item.parentId) : q.is("parentId", null);
  const { data: siblingsData } = await q.order("sortOrder", { ascending: true });
  const siblings = (siblingsData ?? []) as Array<{ id: string; sortOrder: number }>;

  const idx = siblings.findIndex((s) => s.id === itemId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= siblings.length) return { ok: true };

  await supabase
    .from("admission_template_items")
    .update({ sortOrder: siblings[swapIdx].sortOrder })
    .eq("id", siblings[idx].id);
  await supabase
    .from("admission_template_items")
    .update({ sortOrder: siblings[idx].sortOrder })
    .eq("id", siblings[swapIdx].id);

  revalidatePath(PATH);
  return { ok: true };
}
