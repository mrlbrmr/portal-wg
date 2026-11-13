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
  /** Só filiais: localização que a vaga herda. */
  city: string | null;
  state: string | null;
  /** Só cargos: o que o cargo define no formulário de admissão. */
  usesOperationalUniform: boolean | null;
  isDriver: boolean | null;
  isForkliftOperator: boolean | null;
  usage: Usage;
}

const COLUMNS: Record<CatEntity, string> = {
  position: "id, name, active, usesOperationalUniform, isDriver, isForkliftOperator",
  company: "id, name, active",
  branch: "id, name, active, city, state",
  documentType: "id, name, required",
  tag: "id, name, color",
  stage: "id, name, color, active, isFinal, isDocumentIntake",
  applicationSource: "id, name, active",
  area: "id, name, active",
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
    city: entity === "branch" ? ((r.city as string | null) ?? null) : null,
    state: entity === "branch" ? ((r.state as string | null) ?? null) : null,
    usesOperationalUniform: entity === "position" ? !!r.usesOperationalUniform : null,
    isDriver: entity === "position" ? !!r.isDriver : null,
    isForkliftOperator: entity === "position" ? !!r.isForkliftOperator : null,
    usage: usages[i],
  }));
}
