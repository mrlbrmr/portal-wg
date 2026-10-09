// Origens de candidatos (cadastro `application_sources`) — leitura no servidor.
//
// applications.source guarda o CÓDIGO (id do cadastro, ou PORTAL/BANCO_TALENTOS). O rótulo
// é sempre resolvido aqui, no servidor, e chega às telas pronto (`sourceLabel`).

import type { createClient } from "@/lib/supabase/server";
import { APPLICATION_SOURCE_LABELS, MAX_SOURCE_NAME, sourceCodeFromName } from "@/lib/application-schema";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ApplicationSourceOption {
  id: string;
  name: string;
  active: boolean;
}

export async function loadApplicationSources(supabase: Supabase): Promise<ApplicationSourceOption[]> {
  const { data } = await supabase
    .from("application_sources")
    .select("id, name, active")
    .order("sortOrder", { ascending: true });
  return (data ?? []) as ApplicationSourceOption[];
}

/** Código → rótulo, com as origens de sistema. Sem rótulo conhecido, mostra o código. */
export async function loadSourceLabels(supabase: Supabase): Promise<Record<string, string>> {
  return sourceLabelsFrom(await loadApplicationSources(supabase));
}

export function sourceLabelsFrom(rows: ApplicationSourceOption[]): Record<string, string> {
  return { ...APPLICATION_SOURCE_LABELS, ...Object.fromEntries(rows.map((r) => [r.id, r.name])) };
}

export function labelForSource(labels: Record<string, string>, code: string): string {
  return labels[code] ?? APPLICATION_SOURCE_LABELS[code] ?? code;
}

export type ResolveSourceResult = { ok: true; id: string; name: string; created: boolean } | { ok: false; error: string };

/**
 * Origem escolhida no cadastro manual: um código existente e ATIVO, ou o nome de uma
 * origem nova. Nome que já existe (sem diferenciar maiúsculas) reaproveita o cadastro —
 * nunca cria "LinkedIn" e "linkedin"; se estava desativada, volta a ficar ativa.
 */
export async function resolveManualSource(
  supabase: Supabase,
  input: { sourceId?: string | null; newSourceName?: string | null }
): Promise<ResolveSourceResult> {
  const newName = input.newSourceName?.trim().replace(/\s+/g, " ") ?? "";

  if (!newName) {
    if (!input.sourceId) return { ok: false, error: "Informe a origem do candidato." };
    const { data } = await supabase
      .from("application_sources")
      .select("id, name, active")
      .eq("id", input.sourceId)
      .maybeSingle();
    if (!data || !data.active) return { ok: false, error: "Origem inválida. Recarregue a página e tente de novo." };
    return { ok: true, id: data.id as string, name: data.name as string, created: false };
  }

  if (newName.length < 2 || newName.length > MAX_SOURCE_NAME) {
    return { ok: false, error: `O nome da origem deve ter entre 2 e ${MAX_SOURCE_NAME} caracteres.` };
  }

  const { data: existing } = await supabase
    .from("application_sources")
    .select("id, name, active")
    .ilike("name", newName.replace(/[\\%_]/g, (c) => `\\${c}`))
    .maybeSingle();
  if (existing) {
    if (!existing.active) await supabase.from("application_sources").update({ active: true }).eq("id", existing.id);
    return { ok: true, id: existing.id as string, name: existing.name as string, created: false };
  }

  const base = sourceCodeFromName(newName) || "ORIGEM";
  if (base === "PORTAL" || base === "BANCO_TALENTOS") {
    return { ok: false, error: "Esse nome é reservado para as origens do sistema." };
  }
  const { data: max } = await supabase
    .from("application_sources")
    .select("sortOrder")
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = ((max?.sortOrder as number | undefined) ?? 0) + 1;

  // Código derivado do nome; em colisão (outro nome com o mesmo código) ganha sufixo.
  for (let i = 0; i < 5; i++) {
    const id = i === 0 ? base : `${base}_${i + 1}`;
    const { error } = await supabase.from("application_sources").insert({ id, name: newName, sortOrder });
    if (!error) return { ok: true, id, name: newName, created: true };
    if (error.code !== "23505") break;
  }
  return { ok: false, error: "Não foi possível criar a origem. Tente novamente." };
}
