"use server";

// Server actions das Configurações de Admissões — categorias (empresas,
// filiais, cargos, tipos de documento, tags, etapas). Config = ADMIN_RH.
// Deletar é seguro: as FKs em admissions/templates/attachments são SET NULL.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmissionConfig } from "./permissions";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CatEntity = "company" | "branch" | "position" | "documentType" | "tag" | "stage";

const PATH = "/admissoes/configuracoes/categorias";
const DEFAULT_TAG_COLOR = "#64748b";
const DEFAULT_STAGE_COLOR = "#94a3b8";

async function ensureConfig(): Promise<string | null> {
  const a = await requireAdmissionConfig();
  return a.ok ? null : a.status === 401 ? "Não autenticado." : "Sem permissão.";
}

const DUPLICATE = "Já existe um item com esse nome.";

export async function createCategory(
  entity: CatEntity,
  name: string,
  color?: string
): Promise<ActionResult> {
  const err = await ensureConfig();
  if (err) return { ok: false, error: err };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome." };

  try {
    switch (entity) {
      case "company": {
        const n = await prisma.company.count();
        await prisma.company.create({ data: { name: clean, sortOrder: n + 1 } });
        break;
      }
      case "branch": {
        const n = await prisma.branch.count();
        await prisma.branch.create({ data: { name: clean, sortOrder: n + 1 } });
        break;
      }
      case "position": {
        const n = await prisma.position.count();
        await prisma.position.create({ data: { name: clean, sortOrder: n + 1 } });
        break;
      }
      case "documentType": {
        const n = await prisma.documentType.count();
        await prisma.documentType.create({ data: { name: clean, sortOrder: n + 1 } });
        break;
      }
      case "tag":
        await prisma.admissionTag.create({ data: { name: clean, color: color || DEFAULT_TAG_COLOR } });
        break;
      case "stage": {
        const n = await prisma.admissionStage.count();
        await prisma.admissionStage.create({
          data: { name: clean, color: color || DEFAULT_STAGE_COLOR, sortOrder: n + 1 },
        });
        break;
      }
    }
  } catch {
    return { ok: false, error: DUPLICATE };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function renameCategory(
  entity: CatEntity,
  id: string,
  name: string
): Promise<ActionResult> {
  const err = await ensureConfig();
  if (err) return { ok: false, error: err };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome." };

  try {
    switch (entity) {
      case "company": await prisma.company.update({ where: { id }, data: { name: clean } }); break;
      case "branch": await prisma.branch.update({ where: { id }, data: { name: clean } }); break;
      case "position": await prisma.position.update({ where: { id }, data: { name: clean } }); break;
      case "documentType": await prisma.documentType.update({ where: { id }, data: { name: clean } }); break;
      case "tag": await prisma.admissionTag.update({ where: { id }, data: { name: clean } }); break;
      case "stage": await prisma.admissionStage.update({ where: { id }, data: { name: clean } }); break;
    }
  } catch {
    return { ok: false, error: DUPLICATE };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function recolorCategory(
  entity: "tag" | "stage",
  id: string,
  color: string
): Promise<ActionResult> {
  const err = await ensureConfig();
  if (err) return { ok: false, error: err };
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_TAG_COLOR;

  if (entity === "tag") await prisma.admissionTag.update({ where: { id }, data: { color: c } });
  else await prisma.admissionStage.update({ where: { id }, data: { color: c } });

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteCategory(entity: CatEntity, id: string): Promise<ActionResult> {
  const err = await ensureConfig();
  if (err) return { ok: false, error: err };

  try {
    switch (entity) {
      case "company": await prisma.company.delete({ where: { id } }); break;
      case "branch": await prisma.branch.delete({ where: { id } }); break;
      case "position": await prisma.position.delete({ where: { id } }); break;
      case "documentType": await prisma.documentType.delete({ where: { id } }); break;
      case "tag": await prisma.admissionTag.delete({ where: { id } }); break;
      case "stage": await prisma.admissionStage.delete({ where: { id } }); break;
    }
  } catch {
    return { ok: false, error: "Não foi possível remover." };
  }

  revalidatePath(PATH);
  return { ok: true };
}
