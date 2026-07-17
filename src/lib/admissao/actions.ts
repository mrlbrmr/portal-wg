"use server";

// Server actions do módulo de Admissões — checklist e anexos.
// Muitas mutações pequenas: server actions evitam dezenas de route handlers e
// já revalidam a ficha (/admissoes/[id]) após cada mudança. Toda ação exige
// escrita (ADMIN_RH). O download de anexo é uma GET route separada (streaming).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ChecklistItemStatus } from "@prisma/client";
import { requireAdmissionWrite } from "./permissions";
import { deleteAdmissionAttachment } from "./storage";
import { instantiateChecklistFromTemplate } from "./checklist";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toDate(s: string | null | undefined): Date | null {
  return s ? new Date(`${s}T00:00:00`) : null;
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

  const admission = await prisma.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: { id: true },
  });
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

  const last = await prisma.checklistGroup.findFirst({
    where: { admissionId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.checklistGroup.create({
    data: { admissionId, name: clean.slice(0, 120), sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  return done(admissionId);
}

export async function deleteChecklistGroup(admissionId: string, groupId: string): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  await prisma.checklistGroup.deleteMany({ where: { id: groupId, admissionId } });
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

  const group = await prisma.checklistGroup.findFirst({
    where: { id: groupId, admissionId },
    select: { id: true },
  });
  if (!group) return { ok: false, error: "Grupo não encontrado." };

  const last = await prisma.checklistItem.findFirst({
    where: { groupId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.checklistItem.create({
    data: {
      admissionId,
      groupId,
      name: clean.slice(0, 200),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
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

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, admissionId },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Item não encontrado." };

  const data: {
    status?: ChecklistItemStatus;
    dueDate?: Date | null;
    completedAt?: Date | null;
    completedById?: string | null;
  } = {};

  if (patch.status) {
    if (!Object.values(ChecklistItemStatus).includes(patch.status)) {
      return { ok: false, error: "Status inválido." };
    }
    data.status = patch.status;
    if (patch.status === "DONE") {
      data.completedAt = new Date();
      data.completedById = auth.userId;
    } else {
      data.completedAt = null;
      data.completedById = null;
    }
  }
  if (patch.dueDate !== undefined) data.dueDate = toDate(patch.dueDate);

  await prisma.checklistItem.update({ where: { id: itemId }, data });
  return done(admissionId);
}

export async function deleteChecklistItem(admissionId: string, itemId: string): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  await prisma.checklistItem.deleteMany({ where: { id: itemId, admissionId } });
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
  await prisma.admissionAttachment.updateMany({
    where: { id: attachmentId, admissionId },
    data: { documentTypeId: documentTypeId || null },
  });
  return done(admissionId);
}

export async function deleteAttachment(admissionId: string, attachmentId: string): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };

  const att = await prisma.admissionAttachment.findFirst({
    where: { id: attachmentId, admissionId },
    select: { id: true, blobUrl: true },
  });
  if (!att) return { ok: false, error: "Anexo não encontrado." };

  try {
    await deleteAdmissionAttachment(att.blobUrl);
  } catch {
    // Segue removendo o registro mesmo se o blob já não existir.
  }
  await prisma.admissionAttachment.delete({ where: { id: att.id } });
  return done(admissionId);
}
