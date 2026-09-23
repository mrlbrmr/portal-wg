// Casos de uso do Banco de Talentos (servidor). Server actions e rotas são casca fina.
//
// Princípios:
//  • o PERFIL (talentos) nunca é duplicado — adicionar a uma vaga cria só a candidatura;
//  • nada é apagado: arquivar em vez de excluir; tags e anotações não levam histórico junto;
//  • toda ação relevante vai para talento_audit_log (rastreabilidade) — eventos automáticos
//    do processo seletivo (candidatura, etapas) vêm das próprias tabelas e não são editáveis.

import type { createClient } from "@/lib/supabase/server";
import { runStageEntryAutomations } from "@/lib/selection-funnel/run-automations";
import { isActiveJobStatus } from "@/lib/utils";
import { cleanTagName, entryStagesFor, samePhone, sameTagName, phoneDigits, type EditableBankStatus } from "./crm";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface Actor {
  id: string;
  name: string;
}

export type TalentAuditAction =
  | "CRIADO"
  | "DADOS_EDITADOS"
  | "TAGS_ALTERADAS"
  | "STATUS_ALTERADO"
  | "ARQUIVADO"
  | "RESTAURADO"
  | "ADICIONADO_A_VAGA"
  | "FAVORITADO"
  | "DESFAVORITADO";

interface AuditEvent {
  talentoId: string;
  acao: TalentAuditAction;
  descricao: string;
  entidade?: string;
  entidadeId?: string;
  metadata?: Record<string, unknown>;
}

/** Registra ações no histórico. Falha no log nunca desfaz a ação (fica no console). */
export async function logTalentEvents(supabase: Supabase, actor: Actor, events: AuditEvent[]): Promise<void> {
  if (events.length === 0) return;
  const { error } = await supabase.from("talento_audit_log").insert(
    events.map((e) => ({
      talentoId: e.talentoId,
      userId: actor.id,
      acao: e.acao,
      entidade: e.entidade ?? "talentos",
      entidadeId: e.entidadeId ?? e.talentoId,
      descricao: e.descricao.slice(0, 500),
      metadata: { ...(e.metadata ?? {}), actorName: actor.name },
    }))
  );
  if (error) console.warn("[talentos] audit", error.message);
}

async function touch(supabase: Supabase, ids: string[]) {
  if (ids.length === 0) return;
  await supabase.from("talentos").update({ ultimaAtividadeEm: new Date().toISOString() }).in("id", ids);
}

// ─── Tags (cadastro central: admission_tags) ───────────────────────────────────────

export interface TagItem {
  id: string;
  name: string;
  color: string;
}

export async function listTags(supabase: Supabase): Promise<TagItem[]> {
  const { data } = await supabase.from("admission_tags").select("id, name, color").order("name");
  return (data ?? []) as TagItem[];
}

const DEFAULT_TAG_COLOR = "#64748b";

/**
 * Tag pelo nome, sem duplicar: "Excel", "excel" e "EXCEL" apontam para a mesma tag
 * (o banco também garante com um índice único em lower(btrim(name))).
 */
export async function ensureTag(supabase: Supabase, rawName: string): Promise<{ tag: TagItem; created: boolean } | { error: string }> {
  const name = cleanTagName(rawName);
  if (!name) return { error: "Informe o nome da tag." };
  const existing = (await listTags(supabase)).find((t) => sameTagName(t.name, name));
  if (existing) return { tag: existing, created: false };

  const { data, error } = await supabase
    .from("admission_tags")
    .insert({ name, color: DEFAULT_TAG_COLOR })
    .select("id, name, color")
    .single();
  if (data) return { tag: data as TagItem, created: true };
  // Corrida: outra pessoa criou a mesma tag agora — reaproveita.
  const again = (await listTags(supabase)).find((t) => sameTagName(t.name, name));
  if (again) return { tag: again, created: false };
  return { error: error?.message ?? "Não foi possível criar a tag." };
}

async function tagNames(supabase: Supabase, tagIds: string[]): Promise<Map<string, string>> {
  if (tagIds.length === 0) return new Map();
  const { data } = await supabase.from("admission_tags").select("id, name").in("id", tagIds);
  return new Map(((data ?? []) as Array<{ id: string; name: string }>).map((t) => [t.id, t.name]));
}

export async function addTags(supabase: Supabase, actor: Actor, talentoIds: string[], tagIds: string[]): Promise<{ error?: string }> {
  if (talentoIds.length === 0 || tagIds.length === 0) return {};
  const { data: current } = await supabase
    .from("talento_tag_links")
    .select("talentoId, tagId")
    .in("talentoId", talentoIds)
    .in("tagId", tagIds);
  const has = new Set(((current ?? []) as Array<{ talentoId: string; tagId: string }>).map((r) => `${r.talentoId}:${r.tagId}`));
  const rows = talentoIds.flatMap((talentoId) =>
    tagIds.filter((tagId) => !has.has(`${talentoId}:${tagId}`)).map((tagId) => ({ talentoId, tagId, createdById: actor.id }))
  );
  if (rows.length === 0) return {};
  const { error } = await supabase.from("talento_tag_links").insert(rows);
  if (error) return { error: "Não foi possível adicionar a tag." };

  const names = await tagNames(supabase, tagIds);
  const byTalent = new Map<string, string[]>();
  for (const r of rows) byTalent.set(r.talentoId, [...(byTalent.get(r.talentoId) ?? []), names.get(r.tagId) ?? "tag"]);
  await logTalentEvents(
    supabase,
    actor,
    [...byTalent].map(([talentoId, added]) => ({
      talentoId,
      acao: "TAGS_ALTERADAS" as const,
      descricao: `Tag${added.length > 1 ? "s" : ""} adicionada${added.length > 1 ? "s" : ""}: ${added.join(", ")}`,
      metadata: { added },
    }))
  );
  return {};
}

export async function removeTags(supabase: Supabase, actor: Actor, talentoIds: string[], tagIds: string[]): Promise<{ error?: string }> {
  if (talentoIds.length === 0 || tagIds.length === 0) return {};
  const { data: removed, error } = await supabase
    .from("talento_tag_links")
    .delete()
    .in("talentoId", talentoIds)
    .in("tagId", tagIds)
    .select("talentoId, tagId");
  if (error) return { error: "Não foi possível remover a tag." };
  const rows = (removed ?? []) as Array<{ talentoId: string; tagId: string }>;
  if (rows.length === 0) return {};

  const names = await tagNames(supabase, tagIds);
  const byTalent = new Map<string, string[]>();
  for (const r of rows) byTalent.set(r.talentoId, [...(byTalent.get(r.talentoId) ?? []), names.get(r.tagId) ?? "tag"]);
  await logTalentEvents(
    supabase,
    actor,
    [...byTalent].map(([talentoId, list]) => ({
      talentoId,
      acao: "TAGS_ALTERADAS" as const,
      descricao: `Tag${list.length > 1 ? "s" : ""} removida${list.length > 1 ? "s" : ""}: ${list.join(", ")}`,
      metadata: { removed: list },
    }))
  );
  return {};
}

// ─── Status, arquivamento e favoritos ──────────────────────────────────────────────

/** Disponível ⇄ Indisponível. Não mexe em arquivados (esses são restaurados à parte). */
export async function setBankStatus(supabase: Supabase, actor: Actor, ids: string[], status: EditableBankStatus) {
  const target = status === "ATIVO" ? "INDISPONIVEL" : "ATIVO";
  const { data, error } = await supabase
    .from("talentos")
    .update({ statusBanco: status, ultimaAtividadeEm: new Date().toISOString() })
    .in("id", ids)
    .in("statusBanco", target === "ATIVO" ? ["ATIVO", "EM_PROCESSO", "CONTRATADO"] : ["INDISPONIVEL", "NAO_ADERENTE"])
    .select("id");
  if (error) return { error: "Não foi possível alterar o status.", count: 0 };
  const changed = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  await logTalentEvents(
    supabase,
    actor,
    changed.map((talentoId) => ({
      talentoId,
      acao: "STATUS_ALTERADO" as const,
      descricao: status === "ATIVO" ? "Marcado como disponível" : "Marcado como indisponível",
      metadata: { statusBanco: status },
    }))
  );
  return { count: changed.length };
}

export async function archiveTalents(supabase: Supabase, actor: Actor, ids: string[]) {
  const { data, error } = await supabase
    .from("talentos")
    .update({ statusBanco: "ARQUIVADO" })
    .in("id", ids)
    .neq("statusBanco", "ARQUIVADO")
    .select("id");
  if (error) return { error: "Não foi possível arquivar.", count: 0 };
  const changed = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  await logTalentEvents(
    supabase,
    actor,
    changed.map((talentoId) => ({ talentoId, acao: "ARQUIVADO" as const, descricao: "Arquivado no Banco de Talentos" }))
  );
  return { count: changed.length };
}

export async function restoreTalents(supabase: Supabase, actor: Actor, ids: string[]) {
  const { data, error } = await supabase
    .from("talentos")
    .update({ statusBanco: "ATIVO" })
    .in("id", ids)
    .eq("statusBanco", "ARQUIVADO")
    .select("id");
  if (error) return { error: "Não foi possível restaurar.", count: 0 };
  const changed = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  await logTalentEvents(
    supabase,
    actor,
    changed.map((talentoId) => ({ talentoId, acao: "RESTAURADO" as const, descricao: "Restaurado do arquivo" }))
  );
  return { count: changed.length };
}

/** Favorito é do PERFIL (compartilhado pela equipe), não de uma candidatura. */
export async function setFavorite(supabase: Supabase, actor: Actor, ids: string[], value: boolean) {
  const { data, error } = await supabase
    .from("talentos")
    .update({ favorito: value })
    .in("id", ids)
    .eq("favorito", !value)
    .select("id");
  if (error) return { error: "Não foi possível atualizar o favorito.", count: 0 };
  const changed = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  await logTalentEvents(
    supabase,
    actor,
    changed.map((talentoId) => ({
      talentoId,
      acao: value ? ("FAVORITADO" as const) : ("DESFAVORITADO" as const),
      descricao: value ? "Adicionado aos favoritos" : "Removido dos favoritos",
    }))
  );
  return { count: changed.length };
}

// ─── Duplicidade e cadastro manual ─────────────────────────────────────────────────

export interface DuplicateMatch {
  id: string;
  nomeCompleto: string;
  email: string;
  matchedBy: "email" | "telefone";
}

/** Procura talento com o mesmo e-mail (normalizado) ou o mesmo telefone (dígitos). */
export async function findDuplicate(
  supabase: Supabase,
  input: { email?: string | null; telefone?: string | null },
  excludeId?: string
): Promise<DuplicateMatch | null> {
  const email = input.email?.trim().toLowerCase();
  if (email) {
    let q = supabase.from("talentos").select("id, nomeCompleto, email").eq("emailNormalizado", email).limit(1);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q;
    const hit = (data ?? [])[0] as { id: string; nomeCompleto: string; email: string } | undefined;
    if (hit) return { ...hit, matchedBy: "email" };
  }
  const digits = phoneDigits(input.telefone);
  if (digits.length >= 10) {
    // A view guarda os dígitos do telefone na coluna de busca; confirmamos em memória.
    let q = supabase.from("talentos_crm").select("id, nomeCompleto, email, telefone").ilike("busca", `%${digits.slice(-8)}%`).limit(20);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q;
    const hit = ((data ?? []) as Array<{ id: string; nomeCompleto: string; email: string; telefone: string | null }>).find((r) =>
      samePhone(r.telefone, input.telefone)
    );
    if (hit) return { id: hit.id, nomeCompleto: hit.nomeCompleto, email: hit.email, matchedBy: "telefone" };
  }
  return null;
}

export interface NewTalentInput {
  nomeCompleto: string;
  email: string;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cargoDesejado?: string | null;
  areaInteresse?: string | null;
  tagIds?: string[];
  nota?: string | null;
}

export type CreateTalentResult =
  | { ok: true; id: string }
  | { ok: false; error: string; duplicate?: DuplicateMatch };

export async function createTalent(supabase: Supabase, actor: Actor, input: NewTalentInput): Promise<CreateTalentResult> {
  const duplicate = await findDuplicate(supabase, input);
  if (duplicate) {
    return {
      ok: false,
      error: duplicate.matchedBy === "email" ? "Já existe um talento com este e-mail." : "Já existe um talento com este telefone.",
      duplicate,
    };
  }

  const { data, error } = await supabase
    .from("talentos")
    .insert({
      nomeCompleto: input.nomeCompleto.trim(),
      email: input.email.trim(),
      telefone: input.telefone?.trim() || null,
      cidade: input.cidade?.trim() || null,
      estado: input.estado?.trim().toUpperCase() || null,
      cargoDesejado: input.cargoDesejado?.trim() || null,
      areaInteresse: input.areaInteresse?.trim() || null,
      origem: "CADASTRO_MANUAL",
      statusBanco: "ATIVO",
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Já existe um talento com este e-mail." };
    return { ok: false, error: "Não foi possível cadastrar o talento. Tente novamente." };
  }
  const id = data.id as string;

  await logTalentEvents(supabase, actor, [{ talentoId: id, acao: "CRIADO", descricao: "Cadastrado manualmente no Banco de Talentos" }]);
  if (input.tagIds?.length) await addTags(supabase, actor, [id], input.tagIds);
  const nota = input.nota?.trim();
  if (nota) {
    await supabase.from("talento_notes").insert({ talentoId: id, autorId: actor.id, autorNome: actor.name, conteudo: nota });
  }
  return { ok: true, id };
}

// ─── Adicionar à vaga ──────────────────────────────────────────────────────────────

export type AddToJobOutcome =
  | { talentoId: string; nome: string; status: "added"; applicationId: string }
  | { talentoId: string; nome: string; status: "duplicate"; applicationId: string }
  | { talentoId: string; nome: string; status: "error"; message: string };

export type AddToJobResult =
  | { ok: true; jobId: string; jobTitle: string; outcomes: AddToJobOutcome[] }
  | { ok: false; error: string };

/**
 * Coloca talentos do banco num processo seletivo usando a arquitetura atual: cria uma
 * candidatura (applications) ligada ao MESMO perfil (talentoId), origem BANCO_TALENTOS,
 * na etapa inicial escolhida. Nunca cria outra candidatura na mesma vaga: compara por
 * talento, e-mail e CPF (cobre candidaturas ainda não vinculadas ao perfil).
 */
export async function addTalentsToJob(
  supabase: Supabase,
  actor: Actor,
  input: { talentoIds: string[]; jobId: string; stageId?: string | null }
): Promise<AddToJobResult> {
  const ids = [...new Set(input.talentoIds)].slice(0, 200);
  if (ids.length === 0) return { ok: false, error: "Selecione ao menos um talento." };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, status, isTalentPool")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "Vaga não encontrada." };
  if (!isActiveJobStatus(job.status as string) || job.isTalentPool) {
    return { ok: false, error: "Esta vaga não está recebendo candidatos (encerrada, pausada ou cancelada)." };
  }

  // Etapa inicial: precisa estar no funil desta vaga e ser uma etapa de entrada.
  const [{ data: stagesData }, { data: configData }] = await Promise.all([
    supabase.from("application_stages").select("id, name, kind, hideFromBoard").eq("active", true),
    supabase.from("job_stage_config").select("stageId").eq("jobId", job.id),
  ]);
  const configured = new Set(((configData ?? []) as Array<{ stageId: string }>).map((r) => r.stageId));
  const jobStages = ((stagesData ?? []) as Array<{ id: string; name: string; kind: string; hideFromBoard: boolean }>).filter(
    (s) => configured.size === 0 || configured.has(s.id)
  );
  const stageId = input.stageId || "NEW";
  const stage = entryStagesFor(jobStages).find((s) => s.id === stageId);
  if (!stage) return { ok: false, error: "Etapa inicial inválida para esta vaga." };

  const [{ data: talentsData }, { data: existingData }] = await Promise.all([
    supabase
      .from("talentos")
      .select("id, nomeCompleto, email, cpf, telefone, cidade, estado, curriculoUrl, curriculoNome, pretensaoSalarial, statusBanco")
      .in("id", ids),
    supabase.from("applications").select("id, talentoId, email, cpf_digits").eq("jobId", job.id),
  ]);
  const talents = (talentsData ?? []) as Array<{
    id: string;
    nomeCompleto: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
    cidade: string | null;
    estado: string | null;
    curriculoUrl: string | null;
    curriculoNome: string | null;
    pretensaoSalarial: number | null;
    statusBanco: string;
  }>;
  const existing = (existingData ?? []) as Array<{ id: string; talentoId: string | null; email: string; cpf_digits: string | null }>;

  const outcomes: AddToJobOutcome[] = [];
  const added: Array<{ talentoId: string; applicationId: string }> = [];

  for (const id of ids) {
    const t = talents.find((x) => x.id === id);
    if (!t) {
      outcomes.push({ talentoId: id, nome: "Talento", status: "error", message: "Talento não encontrado." });
      continue;
    }
    if (t.statusBanco === "ARQUIVADO") {
      outcomes.push({ talentoId: id, nome: t.nomeCompleto, status: "error", message: "Talento arquivado — restaure antes de adicioná-lo." });
      continue;
    }
    const cpfDigits = (t.cpf ?? "").replace(/\D/g, "");
    const dup = existing.find(
      (a) =>
        a.talentoId === t.id ||
        a.email?.trim().toLowerCase() === t.email.trim().toLowerCase() ||
        (cpfDigits !== "" && a.cpf_digits === cpfDigits)
    );
    if (dup) {
      outcomes.push({ talentoId: id, nome: t.nomeCompleto, status: "duplicate", applicationId: dup.id });
      continue;
    }

    const { data: app, error } = await supabase
      .from("applications")
      .insert({
        jobId: job.id,
        talentoId: t.id,
        fullName: t.nomeCompleto,
        email: t.email,
        phone: t.telefone ?? "",
        cpf: t.cpf,
        candidateCity: t.cidade,
        candidateState: t.estado,
        salaryExpectation: t.pretensaoSalarial,
        resumeUrl: t.curriculoUrl,
        resumeName: t.curriculoNome,
        source: "BANCO_TALENTOS",
        addedBy: actor.name,
        stageId: stage.id,
        consentAt: null,
      })
      .select("id")
      .single();
    if (error || !app) {
      outcomes.push({ talentoId: id, nome: t.nomeCompleto, status: "error", message: "Não foi possível adicionar à vaga." });
      continue;
    }
    const applicationId = app.id as string;
    existing.push({ id: applicationId, talentoId: t.id, email: t.email, cpf_digits: cpfDigits || null });
    added.push({ talentoId: t.id, applicationId });
    outcomes.push({ talentoId: id, nome: t.nomeCompleto, status: "added", applicationId });
  }

  if (added.length > 0) {
    await supabase.from("application_stage_history").insert(
      added.map((a) => ({ applicationId: a.applicationId, stageId: stage.id, changedBy: `${actor.name} (Banco de Talentos)` }))
    );
    if (stage.id !== "NEW") {
      for (const a of added) {
        await runStageEntryAutomations(supabase, { applicationId: a.applicationId, stageId: stage.id, actorName: actor.name });
      }
    }
    await logTalentEvents(
      supabase,
      actor,
      added.map((a) => ({
        talentoId: a.talentoId,
        acao: "ADICIONADO_A_VAGA" as const,
        descricao: `Adicionado à vaga ${job.title} pelo Banco de Talentos`,
        entidade: "applications",
        entidadeId: a.applicationId,
        metadata: { jobId: job.id, jobTitle: job.title, stageId: stage.id, stageName: stage.name },
      }))
    );
  }

  return { ok: true, jobId: job.id as string, jobTitle: job.title as string, outcomes };
}

export { touch as touchTalents };
