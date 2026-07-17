"use server";

// Server actions do módulo de Admissões — checklist e anexos.
// Muitas mutações pequenas: server actions evitam dezenas de route handlers e
// já revalidam a ficha (/admissoes/[id]) após cada mudança. Toda ação exige
// escrita (ADMIN_RH). O download de anexo é uma GET route separada (streaming).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ChecklistItemStatus } from "@prisma/client";
import { requireAdmissionWrite } from "./permissions";
import {
  uploadAdmissionAttachment,
  validateAttachmentFile,
  deleteAdmissionAttachment,
} from "./storage";

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

  const groups = await prisma.templateGroup.findMany({
    where: { templateId },
    orderBy: { sortOrder: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (groups.length === 0) return { ok: false, error: "O modelo não tem itens." };

  const last = await prisma.checklistGroup.findFirst({
    where: { admissionId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let order = last?.sortOrder ?? 0;

  await prisma.$transaction(async (tx) => {
    for (const g of groups) {
      order += 1;
      const newGroup = await tx.checklistGroup.create({
        data: { admissionId, name: g.name, sortOrder: order },
        select: { id: true },
      });
      if (g.items.length > 0) {
        await tx.checklistItem.createMany({
          data: g.items.map((it, idx) => ({
            admissionId,
            groupId: newGroup.id,
            name: it.name,
            description: it.description,
            sortOrder: idx + 1,
          })),
        });
      }
    }
  });

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

export async function uploadAttachment(
  admissionId: string,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };

  const admission = await prisma.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: { id: true },
  });
  if (!admission) return { ok: false, error: "Admissão não encontrada." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Selecione um arquivo." };

  const check = validateAttachmentFile(file);
  if (!check.ok) return { ok: false, error: check.error ?? "Arquivo inválido." };

  const documentTypeIdRaw = formData.get("documentTypeId");
  const documentTypeId =
    typeof documentTypeIdRaw === "string" && documentTypeIdRaw ? documentTypeIdRaw : null;

  let uploaded;
  try {
    uploaded = await uploadAdmissionAttachment(file, admissionId);
  } catch {
    return { ok: false, error: "Falha no upload do arquivo." };
  }

  await prisma.admissionAttachment.create({
    data: {
      admissionId,
      documentTypeId,
      fileName: uploaded.name,
      blobUrl: uploaded.url,
      mimeType: uploaded.mimeType,
      sizeBytes: BigInt(uploaded.sizeBytes),
      uploadedById: auth.userId,
    },
  });

  return done(admissionId);
}

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
