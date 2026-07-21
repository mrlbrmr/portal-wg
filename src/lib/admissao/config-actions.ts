"use server";

// Server actions das Configurações de Admissões — categorias (empresas,
// filiais, cargos, tipos de documento, tags, etapas). Config = ADMIN_RH.
// Deletar é seguro: as FKs em admissions/templates/attachments são SET NULL.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionConfig } from "./permissions";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CatEntity = "company" | "branch" | "position" | "documentType" | "tag" | "stage";

const PATH = "/admissoes/configuracoes/categorias";
const DEFAULT_TAG_COLOR = "#64748b";
const DEFAULT_STAGE_COLOR = "#94a3b8";

// entity → tabela real (schema Supabase).
const TABLE: Record<CatEntity, string> = {
  company: "admission_companies",
  branch: "admission_branches",
  position: "admission_positions",
  documentType: "admission_document_types",
  tag: "admission_tags",
  stage: "admission_stages",
};

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

  const supabase = await createClient();
  const table = TABLE[entity];
  const row: Record<string, unknown> = { name: clean };

  if (entity === "tag") {
    row.color = color || DEFAULT_TAG_COLOR;
  } else {
    // Demais categorias têm sortOrder = (total + 1); stage também guarda cor.
    const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
    row.sortOrder = (count ?? 0) + 1;
    if (entity === "stage") row.color = color || DEFAULT_STAGE_COLOR;
  }

  const { error } = await supabase.from(table).insert(row);
  if (error) return { ok: false, error: DUPLICATE };

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

  const supabase = await createClient();
  const { error } = await supabase.from(TABLE[entity]).update({ name: clean }).eq("id", id);
  if (error) return { ok: false, error: DUPLICATE };

  revalidatePath(PATH);
  return { ok: true };
}

/** Alterna se um tipo de documento é obrigatório (usado no cálculo de % de documentos). */
export async function setDocumentTypeRequired(
  id: string,
  required: boolean
): Promise<ActionResult> {
  const err = await ensureConfig();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  await supabase.from("admission_document_types").update({ required }).eq("id", id);

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

  const supabase = await createClient();
  await supabase.from(TABLE[entity]).update({ color: c }).eq("id", id);

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteCategory(entity: CatEntity, id: string): Promise<ActionResult> {
  const err = await ensureConfig();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase.from(TABLE[entity]).delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível remover." };

  revalidatePath(PATH);
  return { ok: true };
}
