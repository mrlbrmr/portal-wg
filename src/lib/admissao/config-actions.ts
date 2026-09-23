"use server";

// Server actions dos Cadastros de Admissões (Configurações › Cadastros): empresas,
// filiais, cargos, tipos de documento, tags e etapas. Config = ADMIN_RH.
//
// Regra de ouro: nunca perder histórico. Um item EM USO não é excluído — cargos,
// empresas, filiais e etapas são desativados; tipos de documento em uso ficam; tags em
// uso só saem com confirmação explícita de desvincular (a tag é só uma etiqueta).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logConfigChange } from "@/lib/settings/audit";
import { getRegistry } from "@/lib/settings/registry";
import { requireAdmissionConfig } from "./permissions";
import { CATEGORY_TABLE, SUPPORTS_ACTIVE, countUsage, describeUsage, type CatEntity, type Usage } from "./registry-usage";
import type { Session } from "@/lib/auth";

export type { CatEntity } from "./registry-usage";
export type ActionResult = { ok: true } | { ok: false; error: string };

const DEFAULT_TAG_COLOR = "#64748b";
const DEFAULT_STAGE_COLOR = "#94a3b8";
const DUPLICATE = "Já existe um item com esse nome.";
const HEX = /^#[0-9a-fA-F]{6}$/;

async function requireConfig(): Promise<{ session: Session } | { error: string }> {
  const a = await requireAdmissionConfig();
  if (!a.ok) return { error: a.status === 401 ? "Não autenticado." : "Sem permissão." };
  return { session: a.session };
}

function revalidate(entity: CatEntity) {
  revalidatePath(getRegistry(entity).href);
  revalidatePath("/admissoes", "layout");
}

async function log(session: Session, entity: CatEntity, summary: string) {
  await logConfigChange(session, getRegistry(entity).key, summary);
}

function label(entity: CatEntity) {
  const r = getRegistry(entity);
  return r.singular.charAt(0).toUpperCase() + r.singular.slice(1);
}

export async function createCategory(
  entity: CatEntity,
  input: { name: string; color?: string; required?: boolean }
): Promise<ActionResult> {
  const a = await requireConfig();
  if ("error" in a) return { ok: false, error: a.error };
  const clean = input.name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome." };

  const supabase = await createClient();
  const table = CATEGORY_TABLE[entity];
  const row: Record<string, unknown> = { name: clean };

  if (entity === "tag") {
    row.color = HEX.test(input.color ?? "") ? input.color : DEFAULT_TAG_COLOR;
  } else {
    const { data: max } = await supabase
      .from(table)
      .select("sortOrder")
      .order("sortOrder", { ascending: false })
      .limit(1)
      .maybeSingle();
    row.sortOrder = ((max?.sortOrder as number | undefined) ?? 0) + 1;
    if (entity === "stage") row.color = HEX.test(input.color ?? "") ? input.color : DEFAULT_STAGE_COLOR;
    if (entity === "documentType") row.required = !!input.required;
  }

  const { error } = await supabase.from(table).insert(row);
  if (error) return { ok: false, error: DUPLICATE };

  await log(a.session, entity, `${label(entity)} "${clean}" criado(a)`);
  revalidate(entity);
  return { ok: true };
}

export async function updateCategory(
  entity: CatEntity,
  id: string,
  input: { name?: string; color?: string; required?: boolean; active?: boolean }
): Promise<ActionResult> {
  const a = await requireConfig();
  if ("error" in a) return { ok: false, error: a.error };

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const clean = input.name.trim().slice(0, 120);
    if (!clean) return { ok: false, error: "Informe o nome." };
    patch.name = clean;
  }
  if (input.color !== undefined && (entity === "tag" || entity === "stage")) {
    patch.color = HEX.test(input.color) ? input.color : entity === "tag" ? DEFAULT_TAG_COLOR : DEFAULT_STAGE_COLOR;
  }
  if (input.required !== undefined && entity === "documentType") patch.required = input.required;
  if (input.active !== undefined && SUPPORTS_ACTIVE[entity]) patch.active = input.active;
  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const { data: before } = await supabase.from(CATEGORY_TABLE[entity]).select("name").eq("id", id).maybeSingle();
  const { error } = await supabase.from(CATEGORY_TABLE[entity]).update(patch).eq("id", id);
  if (error) return { ok: false, error: patch.name ? DUPLICATE : "Não foi possível salvar." };

  const name = (patch.name as string | undefined) ?? (before?.name as string | undefined) ?? "";
  const what =
    input.active === false ? "desativado(a)" : input.active === true ? "reativado(a)" : "alterado(a)";
  await log(a.session, entity, `${label(entity)} "${name}" ${what}`);
  revalidate(entity);
  return { ok: true };
}

export type DeleteResult =
  | { ok: true }
  | { ok: false; error: string; inUse?: Usage };

/**
 * Exclui um cadastro somente se não estiver em uso. Tags em uso podem ser excluídas
 * com `detachTags: true` (remove a etiqueta das admissões, sem apagar nenhuma admissão).
 */
export async function deleteCategory(
  entity: CatEntity,
  id: string,
  opts: { detachTags?: boolean } = {}
): Promise<DeleteResult> {
  const a = await requireConfig();
  if ("error" in a) return { ok: false, error: a.error };

  const supabase = await createClient();
  const { data: item } = await supabase.from(CATEGORY_TABLE[entity]).select("name").eq("id", id).maybeSingle();
  if (!item) return { ok: false, error: "Item não encontrado." };

  const usage = await countUsage(supabase, entity, id);
  if (usage.total > 0 && !(entity === "tag" && opts.detachTags)) {
    const reg = getRegistry(entity);
    const hint = SUPPORTS_ACTIVE[entity]
      ? ` Desative ${reg.article === "a" ? "a" : "o"} ${reg.singular} para que não apareça em novos cadastros.`
      : "";
    return {
      ok: false,
      error: `Em uso: ${describeUsage(usage)}. A exclusão apagaria esse histórico.${hint}`,
      inUse: usage,
    };
  }

  // Tag: a FK do vínculo é ON DELETE CASCADE — só a etiqueta sai das admissões.
  const { error } = await supabase.from(CATEGORY_TABLE[entity]).delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível excluir." };

  await log(
    a.session,
    entity,
    `${label(entity)} "${item.name}" excluído(a)${usage.total ? ` (removido(a) de ${describeUsage(usage)})` : ""}`
  );
  revalidate(entity);
  return { ok: true };
}

/** Nova ordem completa (arrastar e soltar). */
export async function reorderCategories(entity: CatEntity, orderedIds: string[]): Promise<ActionResult> {
  const a = await requireConfig();
  if ("error" in a) return { ok: false, error: a.error };
  if (entity === "tag") return { ok: false, error: "Tags são ordenadas por nome." };

  const supabase = await createClient();
  const table = CATEGORY_TABLE[entity];
  const { data: rows } = await supabase.from(table).select("id");
  const known = new Set((rows ?? []).map((r) => r.id as string));
  if (orderedIds.length !== known.size || !orderedIds.every((id) => known.has(id))) {
    return { ok: false, error: "A lista mudou. Recarregue a página e tente de novo." };
  }

  const results = await Promise.all(
    orderedIds.map((id, i) => supabase.from(table).update({ sortOrder: i + 1 }).eq("id", id))
  );
  if (results.some((r) => r.error)) return { ok: false, error: "Não foi possível salvar a nova ordem." };

  await log(a.session, entity, "Ordem alterada");
  revalidate(entity);
  return { ok: true };
}

/**
 * Define a ÚNICA etapa de conclusão da admissão (isFinal). Admissões nessa etapa contam
 * como concluídas nas métricas e saem da lista de admissões em andamento.
 */
export async function setConclusionStage(id: string): Promise<ActionResult> {
  const a = await requireConfig();
  if ("error" in a) return { ok: false, error: a.error };

  const supabase = await createClient();
  const { data: stage } = await supabase.from("admission_stages").select("id, name").eq("id", id).maybeSingle();
  if (!stage) return { ok: false, error: "Etapa não encontrada." };

  const on = await supabase.from("admission_stages").update({ isFinal: true }).eq("id", id);
  if (on.error) return { ok: false, error: "Não foi possível definir a etapa de conclusão." };
  await supabase.from("admission_stages").update({ isFinal: false }).neq("id", id).eq("isFinal", true);

  await log(a.session, "stage", `Etapa de conclusão definida: "${stage.name}"`);
  revalidate("stage");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Tira uma etapa do quadro de admissões. As admissões que estão nela podem ser movidas
 * antes para outra etapa ativa. Etapa sem nenhum uso é excluída; com uso, desativada.
 */
export async function removeAdmissionStage(
  id: string,
  opts: { moveTo?: string | null; mode: "delete" | "deactivate" }
): Promise<{ ok: true; outcome: "deleted" | "deactivated"; moved: number } | { ok: false; error: string }> {
  const a = await requireConfig();
  if ("error" in a) return { ok: false, error: a.error };

  const supabase = await createClient();
  const { data: stage } = await supabase
    .from("admission_stages")
    .select("id, name, isFinal")
    .eq("id", id)
    .maybeSingle();
  if (!stage) return { ok: false, error: "Etapa não encontrada." };
  if (stage.isFinal) {
    return { ok: false, error: "Esta é a etapa de conclusão. Escolha outra etapa de conclusão antes de removê-la." };
  }

  let moved = 0;
  if (opts.moveTo) {
    const { data: target } = await supabase
      .from("admission_stages")
      .select("id, active")
      .eq("id", opts.moveTo)
      .maybeSingle();
    if (!target?.active || target.id === id) return { ok: false, error: "Escolha uma etapa de destino ativa." };
    const { data: rows, error } = await supabase
      .from("admissions")
      .update({ stageId: opts.moveTo, updatedById: a.session.user.id })
      .eq("stageId", id)
      .select("id");
    if (error) return { ok: false, error: "Não foi possível mover as admissões." };
    moved = rows?.length ?? 0;
  }

  const usage = await countUsage(supabase, "stage", id);
  let outcome: "deleted" | "deactivated" = "deactivated";
  if (opts.mode === "delete" && usage.total === 0) {
    const { error } = await supabase.from("admission_stages").delete().eq("id", id);
    if (!error) outcome = "deleted";
  }
  if (outcome === "deactivated") {
    const { error } = await supabase.from("admission_stages").update({ active: false }).eq("id", id);
    if (error) return { ok: false, error: "Não foi possível remover a etapa." };
  }

  await log(
    a.session,
    "stage",
    `Etapa "${stage.name}" ${outcome === "deleted" ? "excluída" : "desativada"}${moved ? ` (${moved} admissão(ões) movida(s))` : ""}`
  );
  revalidate("stage");
  return { ok: true, outcome, moved };
}
