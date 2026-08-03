"use server";

// Server actions do Funil de seleção (etapas do Kanban de candidatos).
// Configuração = ADMIN_RH. Espelha o padrão de src/lib/admissao/config-actions.ts.

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type StageKind = "OPEN" | "WON" | "LOST" | "TEST" | "ADMISSION";

const PATH = "/configuracoes/funil";
const DEFAULT_COLOR = "#94a3b8";
const DUPLICATE = "Já existe uma etapa com esse nome.";

async function ensureAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session) return "Não autenticado.";
  if (session.user.role !== "ADMIN_RH") return "Sem permissão.";
  return null;
}

export async function createStage(name: string, color?: string): Promise<ActionResult> {
  const err = await ensureAdmin();
  if (err) return { ok: false, error: err };
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
    sortOrder: ((max?.sortOrder as number | undefined) ?? 0) + 1,
    kind: "OPEN",
  });
  if (error) return { ok: false, error: DUPLICATE };

  revalidatePath(PATH);
  return { ok: true };
}

export async function renameStage(id: string, name: string): Promise<ActionResult> {
  const err = await ensureAdmin();
  if (err) return { ok: false, error: err };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Informe o nome." };

  const supabase = await createClient();
  const { error } = await supabase.from("application_stages").update({ name: clean }).eq("id", id);
  if (error) return { ok: false, error: DUPLICATE };

  revalidatePath(PATH);
  return { ok: true };
}

export async function recolorStage(id: string, color: string): Promise<ActionResult> {
  const err = await ensureAdmin();
  if (err) return { ok: false, error: err };
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR;

  const supabase = await createClient();
  await supabase.from("application_stages").update({ color: c }).eq("id", id);

  revalidatePath(PATH);
  return { ok: true };
}

export async function setStageKind(id: string, kind: StageKind): Promise<ActionResult> {
  const err = await ensureAdmin();
  if (err) return { ok: false, error: err };
  if (!["OPEN", "WON", "LOST", "TEST", "ADMISSION"].includes(kind)) return { ok: false, error: "Tipo inválido." };

  const supabase = await createClient();
  await supabase.from("application_stages").update({ kind }).eq("id", id);

  revalidatePath(PATH);
  return { ok: true };
}

export async function toggleStageActive(id: string, active: boolean): Promise<ActionResult> {
  const err = await ensureAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  await supabase.from("application_stages").update({ active }).eq("id", id);

  revalidatePath(PATH);
  return { ok: true };
}

/** Move a etapa uma posição para cima/baixo trocando o sortOrder com a vizinha. */
export async function moveStage(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const err = await ensureAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("application_stages")
    .select("id, sortOrder")
    .order("sortOrder", { ascending: true });
  if (!stages) return { ok: false, error: "Erro ao reordenar." };

  const idx = stages.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= stages.length) return { ok: true };

  const a = stages[idx];
  const b = stages[swapIdx];
  await supabase.from("application_stages").update({ sortOrder: b.sortOrder }).eq("id", a.id);
  await supabase.from("application_stages").update({ sortOrder: a.sortOrder }).eq("id", b.id);

  revalidatePath(PATH);
  return { ok: true };
}

export async function setStageTemplate(id: string, templateId: string | null): Promise<ActionResult> {
  const err = await ensureAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  await supabase.from("application_stages").update({ templateId: templateId ?? null }).eq("id", id);

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteStage(id: string): Promise<ActionResult> {
  const err = await ensureAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  // FK ON DELETE RESTRICT em applications e application_stage_history: se a etapa
  // já foi usada por algum candidato (agora ou no histórico), o banco recusa.
  const { error } = await supabase.from("application_stages").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error: "Etapa já usada por candidatos — desative-a em vez de excluir.",
    };
  }

  revalidatePath(PATH);
  return { ok: true };
}
