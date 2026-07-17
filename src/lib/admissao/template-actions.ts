"use server";

// Server actions dos Modelos de Checklist (templates por cargo). Config = ADMIN_RH.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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

  const tpl = await prisma.checklistTemplate.create({
    data: { name: clean, positionId: positionId || null, createdById: auth.userId },
    select: { id: true },
  });
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

  await prisma.checklistTemplate.update({ where: { id }, data });
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  await prisma.checklistTemplate.delete({ where: { id } });
  revalidatePath(PATH);
  return { ok: true };
}

export async function addTemplateGroup(templateId: string, name: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome do grupo." };

  const last = await prisma.templateGroup.findFirst({
    where: { templateId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.templateGroup.create({
    data: { templateId, name: clean, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTemplateGroup(groupId: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  await prisma.templateGroup.delete({ where: { id: groupId } });
  revalidatePath(PATH);
  return { ok: true };
}

export async function addTemplateItem(groupId: string, name: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  const clean = name.trim().slice(0, 200);
  if (!clean) return { ok: false, error: "Informe o nome do item." };

  const last = await prisma.templateItem.findFirst({
    where: { groupId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.templateItem.create({
    data: { groupId, name: clean, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTemplateItem(itemId: string): Promise<ActionResult> {
  const auth = await ensureConfig();
  if ("error" in auth) return { ok: false, error: auth.error };
  await prisma.templateItem.delete({ where: { id: itemId } });
  revalidatePath(PATH);
  return { ok: true };
}
