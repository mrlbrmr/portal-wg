"use server";

// Server actions do módulo de Admissões — checklist e anexos.
// Muitas mutações pequenas: server actions evitam dezenas de route handlers e
// já revalidam a ficha (/admissoes/[id]) após cada mudança. Toda ação exige
// escrita (ADMIN_RH). O download de anexo é uma GET route separada (streaming).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ChecklistItemStatus } from "@/types/domain";
import { requireAdmissionWrite } from "./permissions";
import { deleteAdmissionAttachment } from "./storage";
import { instantiateChecklistFromTemplate } from "./checklist";

export type ActionResult = { ok: true } | { ok: false; error: string };

// dueDate é coluna `date` (yyyy-mm-dd) — o form já envia nesse formato.
function toDateString(s: string | null | undefined): string | null {
  return s ? s : null;
}

async function requireWrite(): Promise<{ userId: string } | { error: string }> {
  const a = await requireAdmissionWrite();
  if (!a.ok) return { error: a.status === 401 ? "Não autenticado." : "Sem permissão." };
  return { userId: a.userId };
}

function done(admissionId: string): ActionResult {
  revalidatePath(`/admissoes/${admissionId}`);
  return { ok: true };
}

// ─── Checklist ────────────────────────────────────────────────────────────────

/** Instancia grupos/itens de um modelo no checklist da admissão (soma, não substitui). */
export async function applyChecklistTemplate(
  admissionId: string,
  templateId: string
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!admissionId || !templateId) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: admission } = await supabase
    .from("admissions")
    .select("id")
    .eq("id", admissionId)
    .is("deletedAt", null)
    .maybeSingle();
  if (!admission) return { ok: false, error: "Admissão não encontrada." };

  const created = await instantiateChecklistFromTemplate(admissionId, templateId);
  if (created === 0) return { ok: false, error: "O modelo não tem itens." };

  return done(admissionId);
}

export async function addChecklistGroup(admissionId: string, name: string): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Informe o nome do grupo." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("admission_checklist_groups")
    .select("sortOrder")
    .eq("admissionId", admissionId)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("admission_checklist_groups").insert({
    admissionId,
    name: clean.slice(0, 120),
    sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
  });
  return done(admissionId);
}

export async function deleteChecklistGroup(admissionId: string, groupId: string): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  const supabase = await createClient();
  await supabase
    .from("admission_checklist_groups")
    .delete()
    .eq("id", groupId)
    .eq("admissionId", admissionId);
  return done(admissionId);
}

export async function addChecklistItem(
  admissionId: string,
  groupId: string,
  name: string
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Informe o nome do item." };

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("admission_checklist_groups")
    .select("id")
    .eq("id", groupId)
    .eq("admissionId", admissionId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Grupo não encontrado." };

  const { data: last } = await supabase
    .from("admission_checklist_items")
    .select("sortOrder")
    .eq("groupId", groupId)
    .is("parentId", null)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("admission_checklist_items").insert({
    admissionId,
    groupId,
    name: clean.slice(0, 200),
    sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
  });
  return done(admissionId);
}

/** Adiciona uma subtarefa (item filho) sob um item existente. */
export async function addChecklistSubtask(
  admissionId: string,
  parentItemId: string,
  name: string
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Informe o nome da subtarefa." };

  const supabase = await createClient();
  const { data: parent } = await supabase
    .from("admission_checklist_items")
    .select("id, groupId, parentId")
    .eq("id", parentItemId)
    .eq("admissionId", admissionId)
    .maybeSingle();
  if (!parent) return { ok: false, error: "Item não encontrado." };
  if (parent.parentId) return { ok: false, error: "Subtarefas não podem ter subtarefas." };

  const { data: last } = await supabase
    .from("admission_checklist_items")
    .select("sortOrder")
    .eq("parentId", parentItemId)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("admission_checklist_items").insert({
    admissionId,
    groupId: parent.groupId,
    parentId: parentItemId,
    name: clean.slice(0, 200),
    sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
  });
  return done(admissionId);
}

export async function updateChecklistItem(
  admissionId: string,
  itemId: string,
  patch: { status?: ChecklistItemStatus; dueDate?: string | null }
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("admission_checklist_items")
    .select("id")
    .eq("id", itemId)
    .eq("admissionId", admissionId)
    .maybeSingle();
  if (!item) return { ok: false, error: "Item não encontrado." };

  const data: {
    status?: ChecklistItemStatus;
    dueDate?: string | null;
    completedAt?: string | null;
    completedById?: string | null;
  } = {};

  if (patch.status) {
    if (!Object.values(ChecklistItemStatus).includes(patch.status)) {
      return { ok: false, error: "Status inválido." };
    }
    data.status = patch.status;
    if (patch.status === "DONE") {
      data.completedAt = new Date().toISOString();
      data.completedById = auth.userId;
    } else {
      data.completedAt = null;
      data.completedById = null;
    }
  }
  if (patch.dueDate !== undefined) data.dueDate = toDateString(patch.dueDate);

  await supabase.from("admission_checklist_items").update(data).eq("id", itemId);
  return done(admissionId);
}

export async function deleteChecklistItem(admissionId: string, itemId: string): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  const supabase = await createClient();
  await supabase
    .from("admission_checklist_items")
    .delete()
    .eq("id", itemId)
    .eq("admissionId", admissionId);
  return done(admissionId);
}

export async function moveChecklistGroup(
  admissionId: string,
  groupId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: groupsData } = await supabase
    .from("admission_checklist_groups")
    .select("id, sortOrder")
    .eq("admissionId", admissionId)
    .order("sortOrder", { ascending: true });
  const groups = (groupsData ?? []) as Array<{ id: string; sortOrder: number }>;

  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx === -1) return { ok: false, error: "Grupo não encontrado." };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= groups.length) return { ok: true };

  await supabase
    .from("admission_checklist_groups")
    .update({ sortOrder: groups[swapIdx].sortOrder })
    .eq("id", groups[idx].id);
  await supabase
    .from("admission_checklist_groups")
    .update({ sortOrder: groups[idx].sortOrder })
    .eq("id", groups[swapIdx].id);

  return done(admissionId);
}

export async function moveChecklistItem(
  admissionId: string,
  itemId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("admission_checklist_items")
    .select("groupId, parentId")
    .eq("id", itemId)
    .eq("admissionId", admissionId)
    .maybeSingle();
  if (!item) return { ok: false, error: "Item não encontrado." };

  // Reordena apenas entre irmãos do mesmo escopo (mesmo pai, ou raiz do grupo).
  let q = supabase
    .from("admission_checklist_items")
    .select("id, sortOrder")
    .eq("groupId", item.groupId);
  q = item.parentId ? q.eq("parentId", item.parentId) : q.is("parentId", null);
  const { data: siblingsData } = await q.order("sortOrder", { ascending: true });
  const siblings = (siblingsData ?? []) as Array<{ id: string; sortOrder: number }>;

  const idx = siblings.findIndex((s) => s.id === itemId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return { ok: true };

  await supabase
    .from("admission_checklist_items")
    .update({ sortOrder: siblings[swapIdx].sortOrder })
    .eq("id", siblings[idx].id);
  await supabase
    .from("admission_checklist_items")
    .update({ sortOrder: siblings[idx].sortOrder })
    .eq("id", siblings[swapIdx].id);

  return done(admissionId);
}

export async function duplicateChecklistGroup(
  admissionId: string,
  groupId: string
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("admission_checklist_groups")
    .select("id, name, items:admission_checklist_items(id, name, sortOrder, parentId)")
    .eq("id", groupId)
    .eq("admissionId", admissionId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Grupo não encontrado." };

  const items = ([...((group.items ?? []) as Array<{
    id: string;
    name: string;
    sortOrder: number;
    parentId: string | null;
  }>)]).sort((a, b) => a.sortOrder - b.sortOrder);

  const { data: last } = await supabase
    .from("admission_checklist_groups")
    .select("sortOrder")
    .eq("admissionId", admissionId)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newGroup } = await supabase
    .from("admission_checklist_groups")
    .insert({
      admissionId,
      name: `${group.name} (cópia)`.slice(0, 120),
      sortOrder: ((last?.sortOrder as number | undefined) ?? 0) + 1,
    })
    .select("id")
    .single();
  if (!newGroup) return { ok: false, error: "Erro ao duplicar grupo." };

  // Recria itens de topo primeiro (guardando o mapa id antigo→novo), depois as
  // subtarefas apontando para o novo pai — preservando a hierarquia.
  const topLevel = items.filter((it) => !it.parentId);
  const children = items.filter((it) => it.parentId);
  const idMap = new Map<string, string>();

  for (const it of topLevel) {
    const { data: created } = await supabase
      .from("admission_checklist_items")
      .insert({
        admissionId,
        groupId: newGroup.id,
        name: it.name,
        sortOrder: it.sortOrder,
        status: "PENDING",
      })
      .select("id")
      .single();
    if (created) idMap.set(it.id, created.id);
  }

  const childRows = children
    .filter((it) => it.parentId && idMap.has(it.parentId))
    .map((it) => ({
      admissionId,
      groupId: newGroup.id,
      parentId: idMap.get(it.parentId!)!,
      name: it.name,
      sortOrder: it.sortOrder,
      status: "PENDING" as const,
    }));
  if (childRows.length > 0) {
    await supabase.from("admission_checklist_items").insert(childRows);
  }

  return done(admissionId);
}

// ─── Anexos ───────────────────────────────────────────────────────────────────
// O upload em si é uma API route (POST /api/admissoes/[id]/attachments), pois
// server actions têm limite de ~1 MB de corpo e anexos vão até 10 MB. Aqui
// ficam só as ações leves (categoria e exclusão).

export async function updateAttachmentCategory(
  admissionId: string,
  attachmentId: string,
  documentTypeId: string | null
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  const supabase = await createClient();
  await supabase
    .from("admission_attachments")
    .update({ documentTypeId: documentTypeId || null })
    .eq("id", attachmentId)
    .eq("admissionId", admissionId);
  return done(admissionId);
}

export async function deleteAttachment(admissionId: string, attachmentId: string): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: att } = await supabase
    .from("admission_attachments")
    .select("id, blobUrl")
    .eq("id", attachmentId)
    .eq("admissionId", admissionId)
    .maybeSingle();
  if (!att) return { ok: false, error: "Anexo não encontrado." };

  try {
    await deleteAdmissionAttachment(att.blobUrl);
  } catch {
    // Segue removendo o registro mesmo se o blob já não existir.
  }
  await supabase.from("admission_attachments").delete().eq("id", att.id);
  return done(admissionId);
}
