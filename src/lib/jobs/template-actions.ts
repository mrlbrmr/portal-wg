"use server";

// Ações dos MODELOS DE VAGA (Configurações › Recrutamento › Modelos de vaga e "Salvar como
// modelo" na página da vaga). Casca fina: autentica (ADMIN_RH), valida, grava em
// job_templates e registra em config_change_log. Regras puras em ./templates.ts.
//
// Não existe exclusão: modelo só é arquivado. Nada aqui toca em jobs — vagas criadas a
// partir de um modelo têm o conteúdo COPIADO e não mudam quando o modelo muda.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth, type Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logConfigChange } from "@/lib/settings/audit";
import { ContractType, Modality } from "@/types/domain";
import { duplicateName, TEMPLATE_SELECT_COLUMNS, type JobTemplate, type JobTemplateInput } from "./templates";

export type TemplateActionResult = { ok: true; template: JobTemplate } | { ok: false; error: string };

const MODULE = "modelos-vaga";
const DUPLICATE = "Já existe um modelo com esse nome.";

const text = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null));

const templateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do modelo.").max(120),
  title: z.string().trim().min(2, "Informe o cargo.").max(200),
  department: text(120),
  modality: z.nativeEnum(Modality).nullable().optional().transform((v) => v ?? null),
  contractType: z.nativeEnum(ContractType).nullable().optional().transform((v) => v ?? null),
  workSchedule: text(200),
  about: text(20000),
  responsibilities: text(20000),
  requiredRequirements: text(20000),
  desiredRequirements: text(20000),
  benefits: text(20000),
});

async function requireAdmin(): Promise<Session | null> {
  const session = await auth();
  return session?.user.role === "ADMIN_RH" ? session : null;
}

function actorName(session: Session) {
  return session.user.name ?? session.user.email ?? "Admin";
}

function revalidate() {
  revalidatePath("/configuracoes/modelos-vaga");
  revalidatePath("/vagas/nova");
}

function dbError(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return DUPLICATE;
  console.error("[job-templates]", error);
  return `Não foi possível salvar o modelo${error.message ? ` (${error.message})` : ""}.`;
}

/**
 * Nenhuma falha inesperada sobe como exceção para a tela (viraria "Ocorreu um erro
 * inesperado"): vira { ok: false } com o detalhe, e o erro completo fica no log.
 */
async function guarded(label: string, fn: () => Promise<TemplateActionResult>): Promise<TemplateActionResult> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[job-templates] ${label}`, e);
    const detail = e instanceof Error && e.message ? ` (${e.message})` : "";
    return { ok: false, error: `Não foi possível concluir a operação${detail}. Tente novamente.` };
  }
}

function parse(input: unknown): { ok: true; data: JobTemplateInput } | { ok: false; error: string } {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  return { ok: true, data: parsed.data };
}

export async function createJobTemplate(input: JobTemplateInput): Promise<TemplateActionResult> {
  return guarded("create", () => createJobTemplateImpl(input));
}

async function createJobTemplateImpl(input: JobTemplateInput): Promise<TemplateActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };
  const v = parse(input);
  if (!v.ok) return v;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_templates")
    .insert({ ...v.data, createdBy: actorName(session), updatedBy: actorName(session) })
    .select(TEMPLATE_SELECT_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: dbError(error ?? {}) };

  await logConfigChange(session, MODULE, `Modelo de vaga criado: ${v.data.name}`);
  revalidate();
  return { ok: true, template: data as unknown as JobTemplate };
}

export async function updateJobTemplate(id: string, input: JobTemplateInput): Promise<TemplateActionResult> {
  return guarded("update", () => updateJobTemplateImpl(id, input));
}

async function updateJobTemplateImpl(id: string, input: JobTemplateInput): Promise<TemplateActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };
  const v = parse(input);
  if (!v.ok) return v;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_templates")
    .update({ ...v.data, updatedBy: actorName(session) })
    .eq("id", id)
    .select(TEMPLATE_SELECT_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "Modelo não encontrado." };

  await logConfigChange(session, MODULE, `Modelo de vaga editado: ${v.data.name}`);
  revalidate();
  return { ok: true, template: data as unknown as JobTemplate };
}

export async function duplicateJobTemplate(id: string): Promise<TemplateActionResult> {
  return guarded("duplicate", () => duplicateJobTemplateImpl(id));
}

async function duplicateJobTemplateImpl(id: string): Promise<TemplateActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };

  const supabase = await createClient();
  const [{ data: src }, { data: names }] = await Promise.all([
    supabase.from("job_templates").select(TEMPLATE_SELECT_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("job_templates").select("name"),
  ]);
  if (!src) return { ok: false, error: "Modelo não encontrado." };
  const s = src as unknown as JobTemplate;
  const name = duplicateName(s.name, ((names ?? []) as Array<{ name: string }>).map((n) => n.name));

  const { data, error } = await supabase
    .from("job_templates")
    .insert({
      name,
      title: s.title,
      department: s.department,
      modality: s.modality,
      contractType: s.contractType,
      workSchedule: s.workSchedule,
      about: s.about,
      responsibilities: s.responsibilities,
      requiredRequirements: s.requiredRequirements,
      desiredRequirements: s.desiredRequirements,
      benefits: s.benefits,
      createdBy: actorName(session),
      updatedBy: actorName(session),
    })
    .select(TEMPLATE_SELECT_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: dbError(error ?? {}) };

  await logConfigChange(session, MODULE, `Modelo de vaga duplicado: ${s.name} → ${name}`);
  revalidate();
  return { ok: true, template: data as unknown as JobTemplate };
}

/** Arquivar/reativar. Arquivado some do seletor de "Nova vaga"; vagas existentes não mudam. */
export async function setJobTemplateActive(id: string, active: boolean): Promise<TemplateActionResult> {
  return guarded("active", () => setJobTemplateActiveImpl(id, active));
}

async function setJobTemplateActiveImpl(id: string, active: boolean): Promise<TemplateActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "Sem permissão." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_templates")
    .update({ active, updatedBy: actorName(session) })
    .eq("id", id)
    .select(TEMPLATE_SELECT_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "Modelo não encontrado." };
  const t = data as unknown as JobTemplate;

  await logConfigChange(session, MODULE, `Modelo de vaga ${active ? "reativado" : "arquivado"}: ${t.name}`);
  revalidate();
  return { ok: true, template: t };
}
