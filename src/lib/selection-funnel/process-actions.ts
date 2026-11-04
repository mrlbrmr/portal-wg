"use server";

// Server actions dos MODELOS DE PROCESSO e do processo de cada vaga.
// Casca fina: autentica (ADMIN_RH), valida com as regras puras de ./process-templates.ts,
// grava (de forma atômica pelas funções SQL) e registra em config_change_log.
//
// Vaga ≠ modelo: aplicar um modelo COPIA as etapas para a vaga. Etapa com candidatos
// só sai da vaga se os candidatos forem movidos (nunca fica candidato "órfão").

import { revalidatePath } from "next/cache";
import { auth, type Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logConfigChange } from "@/lib/settings/audit";
import { runStageEntryAutomations } from "./run-automations";
import { loadDefaultTemplateRefs, loadJobStageRefs } from "./process-data";
import {
  removedWithCandidates,
  resolveJobStages,
  validateMoves,
  validateStageSelection,
  type CatalogStage,
  type RemovedStage,
} from "./process-templates";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MODULE = "processos";
const PATH = "/configuracoes/processos";
const DUPLICATE = "Já existe um modelo com esse nome.";
const DEFAULT_COLOR = "#94a3b8";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<Session | null> {
  const session = await auth();
  return session?.user.role === "ADMIN_RH" ? session : null;
}

function actorName(session: Session) {
  return session.user.name ?? session.user.email ?? "Admin";
}

async function loadCatalog(supabase: Supabase): Promise<CatalogStage[]> {
  const { data } = await supabase.from("application_stages").select("id, name, sortOrder, active");
  return (data ?? []) as CatalogStage[];
}

function revalidateAll() {
  revalidatePath(PATH);
  revalidatePath("/vagas", "layout");
}

// ─── Modelos ─────────────────────────────────────────────────────────────────

export interface TemplateInput {
  name: string;
  description?: string | null;
  stageIds: string[];
}

function cleanTemplate(input: TemplateInput): { name: string; description: string | null } | { error: string } {
  const name = input.name.trim().slice(0, 120);
  if (!name) return { error: "Informe o nome do modelo." };
  const description = input.description?.trim().slice(0, 400) || null;
  return { name, description };
}

export async function createProcessTemplate(input: TemplateInput): Promise<ActionResult & { id?: string }> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };
  const clean = cleanTemplate(input);
  if ("error" in clean) return { ok: false, error: clean.error };

  const supabase = await createClient();
  const invalid = validateStageSelection(input.stageIds, await loadCatalog(supabase));
  if (invalid) return { ok: false, error: invalid };

  const { data, error } = await supabase
    .from("process_templates")
    .insert({ ...clean, createdBy: actorName(session), updatedBy: actorName(session) })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? DUPLICATE : "Não foi possível criar o modelo." };

  const { error: rpcError } = await supabase.rpc("process_template_set_stages", {
    p_template: data.id,
    p_stage_ids: input.stageIds,
  });
  if (rpcError) {
    await supabase.from("process_templates").delete().eq("id", data.id);
    return { ok: false, error: "Não foi possível salvar as etapas do modelo." };
  }

  await logConfigChange(session, MODULE, `Modelo de processo "${clean.name}" criado`);
  revalidateAll();
  return { ok: true, id: data.id as string };
}

export async function updateProcessTemplate(id: string, input: TemplateInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };
  const clean = cleanTemplate(input);
  if ("error" in clean) return { ok: false, error: clean.error };

  const supabase = await createClient();
  const invalid = validateStageSelection(input.stageIds, await loadCatalog(supabase));
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase
    .from("process_templates")
    .update({ ...clean, updatedBy: actorName(session) })
    .eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? DUPLICATE : "Não foi possível salvar o modelo." };

  const { error: rpcError } = await supabase.rpc("process_template_set_stages", {
    p_template: id,
    p_stage_ids: input.stageIds,
  });
  if (rpcError) return { ok: false, error: "Não foi possível salvar as etapas do modelo." };

  await logConfigChange(session, MODULE, `Modelo de processo "${clean.name}" alterado`);
  revalidateAll();
  return { ok: true };
}

export async function duplicateProcessTemplate(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };

  const supabase = await createClient();
  const [{ data: src }, { data: all }, { data: links }] = await Promise.all([
    supabase.from("process_templates").select("name, description").eq("id", id).maybeSingle(),
    supabase.from("process_templates").select("name"),
    supabase.from("process_template_stages").select("stageId, sortOrder").eq("templateId", id),
  ]);
  if (!src) return { ok: false, error: "Modelo não encontrado." };

  const names = new Set(((all ?? []) as Array<{ name: string }>).map((t) => t.name.toLowerCase()));
  let name = `${src.name} (cópia)`.slice(0, 120);
  for (let n = 2; names.has(name.toLowerCase()); n++) name = `${src.name} (cópia ${n})`.slice(0, 120);

  const stageIds = ((links ?? []) as Array<{ stageId: string; sortOrder: number }>)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => l.stageId);
  const res = await createProcessTemplate({ name, description: src.description as string | null, stageIds });
  return res.ok ? { ok: true } : res;
}

export async function setDefaultProcessTemplate(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };

  const supabase = await createClient();
  const { data: t } = await supabase.from("process_templates").select("name, active").eq("id", id).maybeSingle();
  if (!t) return { ok: false, error: "Modelo não encontrado." };
  if (!t.active) return { ok: false, error: "Reative o modelo antes de torná-lo o padrão." };

  // Índice único parcial: libera o padrão atual antes de marcar o novo.
  const { error: offError } = await supabase.from("process_templates").update({ isDefault: false }).eq("isDefault", true);
  if (offError) return { ok: false, error: "Não foi possível alterar o modelo padrão." };
  const { error } = await supabase.from("process_templates").update({ isDefault: true }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível alterar o modelo padrão." };

  await logConfigChange(session, MODULE, `Modelo "${t.name}" definido como padrão`);
  revalidateAll();
  return { ok: true };
}

/** Modelo não é excluído: é arquivado (some do seletor; vagas já criadas não mudam). */
export async function setProcessTemplateActive(id: string, active: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };

  const supabase = await createClient();
  const { data: t } = await supabase.from("process_templates").select("name, isDefault").eq("id", id).maybeSingle();
  if (!t) return { ok: false, error: "Modelo não encontrado." };
  if (!active && t.isDefault) return { ok: false, error: "Defina outro modelo como padrão antes de arquivar este." };

  const { error } = await supabase.from("process_templates").update({ active, updatedBy: actorName(session) }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível alterar o modelo." };

  await logConfigChange(session, MODULE, `Modelo "${t.name}" ${active ? "reativado" : "arquivado"}`);
  revalidateAll();
  return { ok: true };
}

// ─── Etapa nova a partir da vaga ─────────────────────────────────────────────

export interface CreatedStage {
  id: string;
  name: string;
  color: string;
}

/**
 * Cria uma etapa no catálogo a partir da vaga (ex.: "Teste prático de campo"). Ela fica
 * disponível para qualquer modelo, mas só entra nas vagas/modelos em que for adicionada.
 */
export async function createStageForProcess(
  name: string,
  color?: string
): Promise<{ ok: true; stage: CreatedStage } | { ok: false; error: string }> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome da etapa." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("application_stages")
    .select("sortOrder")
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();
  const c = /^#[0-9a-fA-F]{6}$/.test(color ?? "") ? (color as string) : DEFAULT_COLOR;

  const { data, error } = await supabase
    .from("application_stages")
    .insert({ name: clean, color: c, sortOrder: ((max?.sortOrder as number | undefined) ?? 0) + 10, kind: "OPEN" })
    .select("id, name, color")
    .single();
  if (error || !data) return { ok: false, error: "Já existe uma etapa com esse nome." };

  await logConfigChange(session, "funil", `Etapa "${clean}" criada`);
  revalidatePath("/configuracoes/funil");
  return { ok: true, stage: data as CreatedStage };
}

// ─── Processo da vaga ────────────────────────────────────────────────────────

export interface SaveJobProcessInput {
  /** Etapas na ordem da vaga. Vazio = voltar a seguir o modelo padrão. */
  stageIds: string[];
  /** Modelo de origem (procedência); null = montado só para a vaga. */
  templateId: string | null;
  /** Para cada etapa removida que tem candidatos: etapa de destino. */
  moves?: Record<string, string>;
}

export type SaveJobProcessResult =
  | { ok: true; moved: number }
  | { ok: false; error: string; needsMoves?: RemovedStage[] };

/** Move os candidatos DESTA vaga de uma etapa para outra, registrando o histórico. */
async function moveJobCandidates(
  supabase: Supabase,
  session: Session,
  jobId: string,
  fromId: string,
  toId: string
): Promise<number | { error: string }> {
  const { data: moved, error } = await supabase
    .from("applications")
    .update({ stageId: toId, sort_order: null })
    .eq("jobId", jobId)
    .eq("stageId", fromId)
    .select("id");
  if (error) return { error: "Não foi possível mover os candidatos." };

  const ids = (moved ?? []).map((r) => r.id as string);
  if (ids.length === 0) return 0;

  const changedBy = actorName(session);
  for (let i = 0; i < ids.length; i += 500) {
    await supabase
      .from("application_stage_history")
      .insert(ids.slice(i, i + 500).map((applicationId) => ({ applicationId, stageId: toId, changedBy })));
  }
  for (const applicationId of ids) {
    await runStageEntryAutomations(supabase, { applicationId, stageId: toId, actorName: changedBy });
  }
  return ids.length;
}

export async function saveJobProcess(jobId: string, input: SaveJobProcessInput): Promise<SaveJobProcessResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };

  const supabase = await createClient();
  const catalog = await loadCatalog(supabase);
  const resetting = input.stageIds.length === 0;

  const [jobRefs, defaultRefs, { data: apps }] = await Promise.all([
    loadJobStageRefs(supabase, jobId),
    loadDefaultTemplateRefs(supabase),
    supabase.from("applications").select("stageId").eq("jobId", jobId),
  ]);

  // Lista de destino: a escolhida, ou (ao redefinir) o que o modelo padrão passaria a mostrar.
  const nextIds = resetting
    ? resolveJobStages(catalog, [], defaultRefs).stages.map((s) => s.id)
    : input.stageIds;
  if (!resetting) {
    const invalid = validateStageSelection(input.stageIds, catalog);
    if (invalid) return { ok: false, error: invalid };
  }

  const currentIds = resolveJobStages(catalog, jobRefs, defaultRefs).stages.map((s) => s.id);
  const counts: Record<string, number> = {};
  for (const a of (apps ?? []) as Array<{ stageId: string }>) counts[a.stageId] = (counts[a.stageId] ?? 0) + 1;

  // Quem está numa etapa que não existirá mais no processo precisa ser movido antes.
  const candidateStageIds = Array.from(new Set([...currentIds, ...Object.keys(counts)]));
  const removed = removedWithCandidates(candidateStageIds, nextIds, counts, catalog);
  const movesError = validateMoves(removed, input.moves, nextIds);
  if (movesError) return { ok: false, error: movesError, needsMoves: removed };

  let moved = 0;
  for (const r of removed) {
    const res = await moveJobCandidates(supabase, session, jobId, r.stageId, input.moves![r.stageId]);
    if (typeof res === "object") return { ok: false, error: res.error };
    moved += res;
  }

  let templateId: string | null = null;
  if (!resetting && input.templateId) {
    const { data: t } = await supabase.from("process_templates").select("id").eq("id", input.templateId).maybeSingle();
    templateId = (t?.id as string | undefined) ?? null;
  }

  const { error } = await supabase.rpc("job_process_set", {
    p_job: jobId,
    p_stage_ids: resetting ? [] : input.stageIds,
    p_template: templateId,
  });
  if (error) return { ok: false, error: "Não foi possível salvar o processo da vaga." };

  revalidateAll();
  revalidatePath(`/vagas/${jobId}`, "layout");
  return { ok: true, moved };
}
