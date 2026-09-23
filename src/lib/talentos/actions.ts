"use server";

// Server actions do Banco de Talentos — casca fina sobre service.ts. Escrita = ADMIN_RH
// (VIEWER_RH só lê, como no resto do painel; o RLS garante o mesmo no banco).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logConfigChange } from "@/lib/settings/audit";
import type { Session } from "@/lib/auth";
import { requireTalentoWrite } from "./permissions";
import { loadTalentIds } from "./list";
import { parseTalentFilters, serializeTalentFilters, type EditableBankStatus } from "./crm";
import {
  addTags,
  addTalentsToJob,
  archiveTalents,
  createTalent,
  ensureTag,
  findDuplicate,
  removeTags,
  restoreTalents,
  setBankStatus,
  setFavorite,
  type Actor,
  type AddToJobResult,
  type CreateTalentResult,
  type DuplicateMatch,
  type TagItem,
} from "./service";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function writer(): Promise<{ actor: Actor; session: Session; supabase: Awaited<ReturnType<typeof createClient>> } | { error: string }> {
  const a = await requireTalentoWrite();
  if (!a.ok) return { error: a.status === 401 ? "Sessão expirada. Entre novamente." : "Você não tem permissão para alterar o Banco de Talentos." };
  return {
    actor: { id: a.userId, name: a.session.user.name ?? a.session.user.email ?? "Equipe de RH" },
    session: a.session,
    supabase: await createClient(),
  };
}

const idsSchema = z.array(z.string().min(1).max(64)).min(1).max(1000);

function revalidateBank(id?: string) {
  revalidatePath("/talentos");
  if (id) revalidatePath(`/talentos/${id}`);
}

/**
 * Alvo de uma ação em massa: ids selecionados na página OU "todos os resultados do
 * filtro" (resolvido no servidor, com o mesmo filtro da listagem).
 */
export type BulkTarget = { ids: string[] } | { filter: Record<string, string> };

async function resolveTarget(supabase: Awaited<ReturnType<typeof createClient>>, target: BulkTarget): Promise<string[] | null> {
  if ("ids" in target) {
    const parsed = idsSchema.safeParse(target.ids);
    return parsed.success ? [...new Set(parsed.data)] : null;
  }
  const ids = await loadTalentIds(supabase, parseTalentFilters(target.filter));
  return ids.length > 0 ? ids : null;
}

// ─── Favoritos, status, arquivo ─────────────────────────────────────────────────────

export async function favoriteTalents(target: BulkTarget, value: boolean): Promise<ActionResult<{ count: number }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const ids = await resolveTarget(w.supabase, target);
  if (!ids) return { ok: false, error: "Nenhum talento selecionado." };
  const r = await setFavorite(w.supabase, w.actor, ids, value);
  if (r.error) return { ok: false, error: r.error };
  revalidateBank(ids.length === 1 ? ids[0] : undefined);
  return { ok: true, count: r.count };
}

export async function changeTalentStatus(target: BulkTarget, status: EditableBankStatus): Promise<ActionResult<{ count: number }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  if (status !== "ATIVO" && status !== "INDISPONIVEL") return { ok: false, error: "Status inválido." };
  const ids = await resolveTarget(w.supabase, target);
  if (!ids) return { ok: false, error: "Nenhum talento selecionado." };
  const r = await setBankStatus(w.supabase, w.actor, ids, status);
  if (r.error) return { ok: false, error: r.error };
  revalidateBank(ids.length === 1 ? ids[0] : undefined);
  return { ok: true, count: r.count };
}

export async function archiveTalentsAction(target: BulkTarget): Promise<ActionResult<{ count: number }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const ids = await resolveTarget(w.supabase, target);
  if (!ids) return { ok: false, error: "Nenhum talento selecionado." };
  const r = await archiveTalents(w.supabase, w.actor, ids);
  if (r.error) return { ok: false, error: r.error };
  revalidateBank(ids.length === 1 ? ids[0] : undefined);
  return { ok: true, count: r.count };
}

export async function restoreTalentsAction(target: BulkTarget): Promise<ActionResult<{ count: number }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const ids = await resolveTarget(w.supabase, target);
  if (!ids) return { ok: false, error: "Nenhum talento selecionado." };
  const r = await restoreTalents(w.supabase, w.actor, ids);
  if (r.error) return { ok: false, error: r.error };
  revalidateBank(ids.length === 1 ? ids[0] : undefined);
  return { ok: true, count: r.count };
}

// ─── Tags ───────────────────────────────────────────────────────────────────────────

/** Cria (ou reaproveita, ignorando caixa) uma tag no cadastro central. */
export async function createTalentTag(name: string): Promise<ActionResult<{ tag: TagItem; created: boolean }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const r = await ensureTag(w.supabase, String(name ?? ""));
  if ("error" in r) return { ok: false, error: r.error };
  if (r.created) {
    await logConfigChange(
      w.session,
      "cadastros.tags",
      `Tag "${r.tag.name}" criada pelo Banco de Talentos`
    );
    revalidatePath("/configuracoes/cadastros/tags");
  }
  return { ok: true, tag: r.tag, created: r.created };
}

export async function addTagsToTalents(target: BulkTarget, tagIds: string[]): Promise<ActionResult<{ count: number }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const ids = await resolveTarget(w.supabase, target);
  const tags = idsSchema.safeParse(tagIds);
  if (!ids || !tags.success) return { ok: false, error: "Selecione talentos e tags." };
  const r = await addTags(w.supabase, w.actor, ids, tags.data);
  if (r.error) return { ok: false, error: r.error };
  revalidateBank(ids.length === 1 ? ids[0] : undefined);
  return { ok: true, count: ids.length };
}

export async function removeTagsFromTalents(target: BulkTarget, tagIds: string[]): Promise<ActionResult<{ count: number }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const ids = await resolveTarget(w.supabase, target);
  const tags = idsSchema.safeParse(tagIds);
  if (!ids || !tags.success) return { ok: false, error: "Selecione talentos e tags." };
  const r = await removeTags(w.supabase, w.actor, ids, tags.data);
  if (r.error) return { ok: false, error: r.error };
  revalidateBank(ids.length === 1 ? ids[0] : undefined);
  return { ok: true, count: ids.length };
}

// ─── Cadastro manual ────────────────────────────────────────────────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const newTalentSchema = z.object({
  nomeCompleto: z.string().trim().min(3, "Informe o nome completo.").max(120),
  email: z.string().trim().email("E-mail inválido.").max(150),
  telefone: optionalText(30).refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Telefone inválido."),
  cidade: optionalText(80),
  estado: optionalText(2),
  cargoDesejado: optionalText(120),
  areaInteresse: optionalText(80),
  tagIds: z.array(z.string().min(1)).max(20).optional(),
  nota: optionalText(5000),
});

export type NewTalentForm = z.input<typeof newTalentSchema>;

/** Aviso antecipado no formulário: já existe talento com este e-mail/telefone? */
export async function checkTalentDuplicate(input: { email?: string; telefone?: string }): Promise<DuplicateMatch | null> {
  const a = await requireTalentoWrite();
  if (!a.ok) return null;
  const email = typeof input.email === "string" && z.string().email().safeParse(input.email.trim()).success ? input.email : null;
  const telefone = typeof input.telefone === "string" ? input.telefone : null;
  if (!email && !telefone) return null;
  return findDuplicate(await createClient(), { email, telefone });
}

export async function createTalentAction(input: NewTalentForm): Promise<CreateTalentResult> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const parsed = newTalentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const r = await createTalent(w.supabase, w.actor, parsed.data);
  if (r.ok) revalidateBank();
  return r;
}

// ─── Adicionar à vaga ───────────────────────────────────────────────────────────────

export async function addTalentsToJobAction(input: { target: BulkTarget; jobId: string; stageId?: string | null }): Promise<AddToJobResult> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const ids = await resolveTarget(w.supabase, input.target);
  if (!ids || typeof input.jobId !== "string" || !input.jobId) return { ok: false, error: "Escolha a vaga e ao menos um talento." };
  if (ids.length > 200) return { ok: false, error: "Adicione até 200 talentos por vez. Refine os filtros." };
  const r = await addTalentsToJob(w.supabase, w.actor, { talentoIds: ids, jobId: input.jobId, stageId: input.stageId ?? null });
  if (r.ok) {
    revalidateBank(ids.length === 1 ? ids[0] : undefined);
    revalidatePath(`/vagas/${r.jobId}/candidatos`);
    revalidatePath("/dashboard");
  }
  return r;
}

// ─── Anotações ──────────────────────────────────────────────────────────────────────

const noteSchema = z.string().trim().min(1, "Escreva a anotação.").max(5000, "Máximo de 5.000 caracteres.");

export interface NoteDto {
  id: string;
  autorId: string;
  autorNome: string | null;
  conteudo: string;
  createdAt: string;
  updatedAt: string;
}
const NOTE_COLUMNS = "id, autorId, autorNome, conteudo, createdAt, updatedAt";

export async function createTalentNote(talentoId: string, body: string): Promise<ActionResult<{ note: NoteDto }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { data, error } = await w.supabase
    .from("talento_notes")
    .insert({ talentoId, autorId: w.actor.id, autorNome: w.actor.name, conteudo: parsed.data })
    .select(NOTE_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível salvar a anotação. Tente novamente." };
  revalidateBank(talentoId);
  return { ok: true, note: data as NoteDto };
}

/** Só o autor edita (RLS garante: a atualização de nota alheia não afeta nenhuma linha). */
export async function updateTalentNote(noteId: string, body: string): Promise<ActionResult<{ note: NoteDto }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { data, error } = await w.supabase
    .from("talento_notes")
    .update({ conteudo: parsed.data })
    .eq("id", noteId)
    .eq("autorId", w.actor.id)
    .select(`${NOTE_COLUMNS}, talentoId`)
    .maybeSingle();
  if (error) return { ok: false, error: "Não foi possível salvar a anotação. Tente novamente." };
  if (!data) return { ok: false, error: "Só quem escreveu a anotação pode editá-la." };
  revalidateBank((data as { talentoId: string }).talentoId);
  return { ok: true, note: data as NoteDto };
}

/** Autor ou administrador exclui (hoje todo autor é administrador). */
export async function deleteTalentNote(noteId: string): Promise<ActionResult> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const { data, error } = await w.supabase.from("talento_notes").delete().eq("id", noteId).select("talentoId").maybeSingle();
  if (error) return { ok: false, error: "Não foi possível excluir a anotação." };
  if (!data) return { ok: false, error: "Anotação não encontrada." };
  revalidateBank((data as { talentoId: string }).talentoId);
  return { ok: true };
}

// ─── Segmentos salvos ───────────────────────────────────────────────────────────────

export interface SegmentDto {
  id: string;
  nome: string;
  filtros: Record<string, string>;
  criadoPorNome: string;
  updatedAt: string;
}

const segmentNameSchema = z.string().trim().min(1, "Dê um nome ao segmento.").max(80, "Use até 80 caracteres.");

/** Guarda só a combinação de filtros — nunca a lista de candidatos. */
function cleanSegmentFilters(filtros: Record<string, string>): Record<string, string> {
  const clean = serializeTalentFilters(parseTalentFilters(filtros ?? {}));
  return clean;
}

export async function saveSegment(nome: string, filtros: Record<string, string>): Promise<ActionResult<{ segment: SegmentDto }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const parsed = segmentNameSchema.safeParse(nome);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const clean = cleanSegmentFilters(filtros);
  if (Object.keys(clean).length === 0) return { ok: false, error: "Aplique ao menos um filtro antes de salvar o segmento." };
  const { data, error } = await w.supabase
    .from("talento_segments")
    .insert({ nome: parsed.data, filtros: clean, criadoPorId: w.actor.id, criadoPorNome: w.actor.name })
    .select("id, nome, filtros, criadoPorNome, updatedAt")
    .single();
  if (error?.code === "23505") return { ok: false, error: "Já existe um segmento com esse nome." };
  if (error || !data) return { ok: false, error: "Não foi possível salvar o segmento." };
  revalidateBank();
  return { ok: true, segment: data as SegmentDto };
}

export async function updateSegment(
  id: string,
  patch: { nome?: string; filtros?: Record<string, string> }
): Promise<ActionResult<{ segment: SegmentDto }>> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const row: Record<string, unknown> = {};
  if (patch.nome !== undefined) {
    const parsed = segmentNameSchema.safeParse(patch.nome);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    row.nome = parsed.data;
  }
  if (patch.filtros !== undefined) {
    const clean = cleanSegmentFilters(patch.filtros);
    if (Object.keys(clean).length === 0) return { ok: false, error: "O segmento precisa de ao menos um filtro." };
    row.filtros = clean;
  }
  const { data, error } = await w.supabase
    .from("talento_segments")
    .update(row)
    .eq("id", id)
    .select("id, nome, filtros, criadoPorNome, updatedAt")
    .maybeSingle();
  if (error?.code === "23505") return { ok: false, error: "Já existe um segmento com esse nome." };
  if (error || !data) return { ok: false, error: "Não foi possível atualizar o segmento." };
  revalidateBank();
  return { ok: true, segment: data as SegmentDto };
}

export async function deleteSegment(id: string): Promise<ActionResult> {
  const w = await writer();
  if ("error" in w) return { ok: false, error: w.error };
  const { error } = await w.supabase.from("talento_segments").delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível excluir o segmento." };
  revalidateBank();
  return { ok: true };
}
