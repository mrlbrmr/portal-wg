// Leitura dos Cadastros de Admissões para as telas de Configurações, com o uso de cada item.

import { createClient } from "@/lib/supabase/server";
import { CATEGORY_TABLE, SUPPORTS_ACTIVE, countUsage, type CatEntity, type Usage } from "./registry-usage";

export interface RegistryItem {
  id: string;
  name: string;
  /** null = o cadastro não tem status (tags, tipos de documento). */
  active: boolean | null;
  color: string | null;
  required: boolean | null;
  isFinal: boolean | null;
  /** Etapa para onde a admissão avança quando o candidato começa a enviar documentos. */
  isDocumentIntake: boolean | null;
  usage: Usage;
}

const COLUMNS: Record<CatEntity, string> = {
  position: "id, name, active",
  company: "id, name, active",
  branch: "id, name, active",
  documentType: "id, name, required",
  tag: "id, name, color",
  stage: "id, name, color, active, isFinal, isDocumentIntake",
};

export async function loadRegistryItems(entity: CatEntity): Promise<RegistryItem[]> {
  const supabase = await createClient();
  const query = supabase.from(CATEGORY_TABLE[entity]).select(COLUMNS[entity]);
  const { data } = await (entity === "tag"
    ? query.order("name", { ascending: true })
    : query.order("sortOrder", { ascending: true }));

  const rows = (data ?? []) as unknown as Array<Record<string, unknown> & { id: string; name: string }>;
  const usages = await Promise.all(rows.map((r) => countUsage(supabase, entity, r.id)));

  return rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    active: SUPPORTS_ACTIVE[entity] ? (r.active as boolean) ?? true : null,
    color: (r.color as string | undefined) ?? null,
    required: entity === "documentType" ? !!r.required : null,
    isFinal: entity === "stage" ? !!r.isFinal : null,
    isDocumentIntake: entity === "stage" ? !!r.isDocumentIntake : null,
    usage: usages[i],
  }));
}
