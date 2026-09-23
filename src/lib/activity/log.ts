import type { SupabaseClient } from "@supabase/supabase-js";

// Gravação de atividades em admission_activity_log (tabela genérica: entity/entityId/
// action/metadata). Os códigos de `action` estão mapeados em ./catalog.ts — é isso que
// faz o evento aparecer em Atividades. Mesma regra do registro de configurações:
// falha no log NUNCA desfaz nem bloqueia a operação principal.

export interface FieldChangeMeta {
  /** Rótulo legível ("Data do ASO"). */
  label: string;
  from: string | null;
  to: string | null;
}

export interface ActivityMetadata {
  /** Estado anterior → novo (etapa, perfil). */
  from?: string | null;
  to?: string | null;
  /** Campos alterados numa edição. */
  changes?: FieldChangeMeta[];
  /** Nome do alvo — preservado para quando o registro original for excluído. */
  subjectName?: string;
  [key: string]: unknown;
}

export async function logActivity(
  supabase: SupabaseClient,
  entry: {
    action: string;
    entity: "ADMISSION" | "USER" | "ADMISSION_ATTACHMENT";
    entityId?: string | null;
    admissionId?: string | null;
    userId?: string | null;
    description?: string | null;
    metadata?: ActivityMetadata | null;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from("admission_activity_log").insert({
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      admissionId: entry.admissionId ?? null,
      userId: entry.userId ?? null,
      description: entry.description?.slice(0, 500) ?? null,
      metadata: entry.metadata ?? null,
    });
    if (error) console.warn("[activity-log]", entry.action, error.message);
  } catch (e) {
    console.warn("[activity-log]", entry.action, e);
  }
}

/** Compara dois retratos de campos e devolve só o que mudou (valores já formatados). */
export function diffFields(
  before: Record<string, string | null>,
  after: Record<string, string | null>,
  labels: Record<string, string>
): FieldChangeMeta[] {
  const out: FieldChangeMeta[] = [];
  for (const key of Object.keys(labels)) {
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    if ((a ?? "") !== (b ?? "")) out.push({ label: labels[key], from: a, to: b });
  }
  return out;
}
