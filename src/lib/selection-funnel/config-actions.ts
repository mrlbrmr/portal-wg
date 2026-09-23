"use server";

// Server actions do Funil de seleção (etapas do Kanban de candidatos).
// Configuração = ADMIN_RH. Toda alteração fica no registro de alterações (config_change_log).

import { revalidatePath } from "next/cache";
import { auth, type Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logConfigChange } from "@/lib/settings/audit";
import { AUTOMATIONS, isStageKind, type StageAutomations, type StageKind } from "./automations";

export type { StageKind } from "./automations";
export type ActionResult = { ok: true } | { ok: false; error: string };

const PATH = "/configuracoes/funil";
const MODULE = "funil";
const DEFAULT_COLOR = "#94a3b8";
const DUPLICATE = "Já existe uma etapa com esse nome.";

async function requireAdmin(): Promise<{ session: Session } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "Não autenticado." };
  if (session.user.role !== "ADMIN_RH") return { error: "Sem permissão." };
  return { session };
}

function done(): ActionResult {
  revalidatePath(PATH);
  return { ok: true };
}

async function stageName(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<string> {
  const { data } = await supabase.from("application_stages").select("name").eq("id", id).maybeSingle();
  return (data?.name as string | undefined) ?? "etapa";
}

export async function createStage(name: string, color?: string): Promise<ActionResult> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome da etapa." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("application_stages")
    .select("sortOrder")
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("application_stages").insert({
    name: clean,
    color: /^#[0-9a-fA-F]{6}$/.test(color ?? "") ? color : DEFAULT_COLOR,
    sortOrder: ((max?.sortOrder as number | undefined) ?? 0) + 10,
    kind: "OPEN",
  });
  if (error) return { ok: false, error: DUPLICATE };

  await logConfigChange(a.session, MODULE, `Etapa "${clean}" criada`);
  return done();
}

export async function renameStage(id: string, name: string): Promise<ActionResult> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome." };

  const supabase = await createClient();
  const before = await stageName(supabase, id);
  const { error } = await supabase.from("application_stages").update({ name: clean }).eq("id", id);
  if (error) return { ok: false, error: DUPLICATE };

  await logConfigChange(a.session, MODULE, `Etapa "${before}" renomeada para "${clean}"`);
  return done();
}

export async function recolorStage(id: string, color: string): Promise<ActionResult> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR;

  const supabase = await createClient();
  const { error } = await supabase.from("application_stages").update({ color: c }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível alterar a cor." };

  await logConfigChange(a.session, MODULE, `Cor da etapa "${await stageName(supabase, id)}" alterada`);
  return done();
}

export async function setStageKind(id: string, kind: StageKind): Promise<ActionResult> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };
  if (!isStageKind(kind)) return { ok: false, error: "Tipo inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("application_stages").update({ kind }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível alterar o tipo." };

  await logConfigChange(a.session, MODULE, `Tipo da etapa "${await stageName(supabase, id)}" alterado`);
  return done();
}

export async function setStageBoardVisibility(id: string, showOnBoard: boolean): Promise<ActionResult> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };

  const supabase = await createClient();
  const { error } = await supabase.from("application_stages").update({ hideFromBoard: !showOnBoard }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível alterar a exibição." };

  await logConfigChange(
    a.session,
    MODULE,
    `Etapa "${await stageName(supabase, id)}" ${showOnBoard ? "exibida" : "ocultada"} no quadro de candidatos`
  );
  return done();
}

export async function setStageTemplate(id: string, templateId: string | null): Promise<ActionResult> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };

  const supabase = await createClient();
  const { error } = await supabase.from("application_stages").update({ templateId: templateId ?? null }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível vincular o teste." };

  await logConfigChange(a.session, MODULE, `Teste vinculado à etapa "${await stageName(supabase, id)}" alterado`);
  return done();
}

export async function setStageAutomations(id: string, automations: StageAutomations): Promise<ActionResult> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };

  // Só grava chaves conhecidas, com valor booleano.
  const clean: StageAutomations = {};
  for (const def of AUTOMATIONS) {
    const v = automations[def.key];
    if (typeof v === "boolean") clean[def.key] = v;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("application_stages").update({ automations: clean }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível salvar as automações." };

  await logConfigChange(a.session, MODULE, `Automações da etapa "${await stageName(supabase, id)}" alteradas`);
  return done();
}

/** Nova ordem completa do funil (arrastar e soltar ou "Mover para cima/baixo"). */
export async function reorderStages(orderedIds: string[]): Promise<ActionResult> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };

  const supabase = await createClient();
  const { data: stages } = await supabase.from("application_stages").select("id");
  const known = new Set((stages ?? []).map((s) => s.id as string));
  if (orderedIds.length !== known.size || !orderedIds.every((id) => known.has(id))) {
    return { ok: false, error: "A lista de etapas mudou. Recarregue a página e tente de novo." };
  }

  const results = await Promise.all(
    orderedIds.map((id, i) => supabase.from("application_stages").update({ sortOrder: (i + 1) * 10 }).eq("id", id))
  );
  if (results.some((r) => r.error)) return { ok: false, error: "Não foi possível salvar a nova ordem." };

  await logConfigChange(a.session, MODULE, "Ordem das etapas alterada");
  return done();
}

/** Duplica a etapa logo abaixo da original (mesmo tipo, cor, teste e automações). */
export async function duplicateStage(id: string): Promise<ActionResult> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };

  const supabase = await createClient();
  const { data: all } = await supabase
    .from("application_stages")
    .select("id, name, color, kind, templateId, hideFromBoard, automations, active")
    .order("sortOrder", { ascending: true });
  const list = (all ?? []) as Array<Record<string, unknown> & { id: string; name: string }>;
  const src = list.find((s) => s.id === id);
  if (!src) return { ok: false, error: "Etapa não encontrada." };

  const names = new Set(list.map((s) => s.name.toLowerCase()));
  let name = `${src.name} (cópia)`.slice(0, 120);
  for (let n = 2; names.has(name.toLowerCase()); n++) name = `${src.name} (cópia ${n})`.slice(0, 120);

  const { data: created, error } = await supabase
    .from("application_stages")
    .insert({
      name,
      color: src.color,
      kind: src.kind,
      templateId: src.templateId ?? null,
      hideFromBoard: src.hideFromBoard ?? false,
      automations: src.automations ?? {},
      active: true,
      sortOrder: 0,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Não foi possível duplicar a etapa." };

  const ids = list.map((s) => s.id);
  ids.splice(ids.indexOf(id) + 1, 0, created.id as string);
  await Promise.all(
    ids.map((sid, i) => supabase.from("application_stages").update({ sortOrder: (i + 1) * 10 }).eq("id", sid))
  );

  await logConfigChange(a.session, MODULE, `Etapa "${src.name}" duplicada`);
  return done();
}

export interface StageUsage {
  /** Candidatos que estão nesta etapa agora. */
  current: number;
  /** Registros de histórico que passam por esta etapa (impedem a exclusão). */
  history: number;
}

export async function getStageUsage(id: string): Promise<{ ok: true; usage: StageUsage } | { ok: false; error: string }> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };

  const supabase = await createClient();
  const [cur, hist] = await Promise.all([
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("stageId", id),
    supabase.from("application_stage_history").select("id", { count: "exact", head: true }).eq("stageId", id),
  ]);
  if (cur.error || hist.error) return { ok: false, error: "Não foi possível verificar o uso da etapa." };
  return { ok: true, usage: { current: cur.count ?? 0, history: hist.count ?? 0 } };
}

/** Move todos os candidatos de uma etapa para outra, registrando no histórico. */
async function moveCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: Session,
  fromId: string,
  toId: string
): Promise<{ moved: number } | { error: string }> {
  const { data: target } = await supabase
    .from("application_stages")
    .select("id, active")
    .eq("id", toId)
    .maybeSingle();
  if (!target || !target.active || toId === fromId) return { error: "Escolha uma etapa de destino ativa." };

  const { data: apps } = await supabase.from("applications").select("id").eq("stageId", fromId);
  const ids = (apps ?? []).map((r) => r.id as string);
  if (ids.length === 0) return { moved: 0 };

  const { error } = await supabase
    .from("applications")
    .update({ stageId: toId, sort_order: null })
    .in("id", ids)
    .eq("stageId", fromId);
  if (error) return { error: "Não foi possível mover os candidatos." };

  const changedBy = session.user.name ?? session.user.email ?? "Admin";
  await supabase
    .from("application_stage_history")
    .insert(ids.map((applicationId) => ({ applicationId, stageId: toId, changedBy })));
  revalidatePath("/vagas", "layout");
  return { moved: ids.length };
}

export type RemovalOutcome = "deleted" | "deactivated";

/**
 * Remove uma etapa do funil SEM perder candidatos nem histórico:
 *  • se há candidatos nela, eles são movidos para `moveTo` (obrigatório);
 *  • se ela nunca foi usada, é excluída;
 *  • se já aparece no histórico, é desativada (sai do funil, o histórico continua).
 */
export async function removeStage(
  id: string,
  opts: { moveTo?: string | null } = {}
): Promise<{ ok: true; outcome: RemovalOutcome; moved: number } | { ok: false; error: string }> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };

  const supabase = await createClient();
  const name = await stageName(supabase, id);
  const { count: current } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("stageId", id);

  let moved = 0;
  if ((current ?? 0) > 0) {
    if (!opts.moveTo) return { ok: false, error: "Escolha para qual etapa os candidatos serão movidos." };
    const res = await moveCandidates(supabase, a.session, id, opts.moveTo);
    if ("error" in res) return { ok: false, error: res.error };
    moved = res.moved;
  }

  // FK ON DELETE RESTRICT em applications e application_stage_history: se a etapa já
  // foi usada (agora ou no histórico), o banco recusa — então ela é desativada.
  const { error: delError } = await supabase.from("application_stages").delete().eq("id", id);
  if (!delError) {
    await logConfigChange(a.session, MODULE, `Etapa "${name}" excluída`);
    revalidatePath(PATH);
    return { ok: true, outcome: "deleted", moved };
  }

  const { error: offError } = await supabase.from("application_stages").update({ active: false }).eq("id", id);
  if (offError) return { ok: false, error: "Não foi possível remover a etapa." };
  await logConfigChange(
    a.session,
    MODULE,
    `Etapa "${name}" desativada${moved ? ` (${moved} candidato(s) movido(s))` : ""}`
  );
  revalidatePath(PATH);
  return { ok: true, outcome: "deactivated", moved };
}

/** Ativa/desativa a etapa. Ao desativar, pode mover antes os candidatos que estão nela. */
export async function setStageActive(
  id: string,
  active: boolean,
  opts: { moveTo?: string | null } = {}
): Promise<ActionResult> {
  const a = await requireAdmin();
  if ("error" in a) return { ok: false, error: a.error };

  const supabase = await createClient();
  let moved = 0;
  if (!active && opts.moveTo) {
    const res = await moveCandidates(supabase, a.session, id, opts.moveTo);
    if ("error" in res) return { ok: false, error: res.error };
    moved = res.moved;
  }

  const { error } = await supabase.from("application_stages").update({ active }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível alterar a etapa." };

  const name = await stageName(supabase, id);
  await logConfigChange(
    a.session,
    MODULE,
    `Etapa "${name}" ${active ? "reativada" : "desativada"}${moved ? ` (${moved} candidato(s) movido(s))` : ""}`
  );
  return done();
}
