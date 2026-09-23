// Onde cada cadastro de Admissões é usado — base para mostrar a coluna "Uso" e para
// impedir exclusões que apagariam histórico (as FKs são ON DELETE SET NULL/CASCADE:
// excluir um cargo em uso deixaria admissões sem cargo, silenciosamente).

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CatEntity = "company" | "branch" | "position" | "documentType" | "tag" | "stage";

export const CATEGORY_TABLE: Record<CatEntity, string> = {
  company: "admission_companies",
  branch: "admission_branches",
  position: "admission_positions",
  documentType: "admission_document_types",
  tag: "admission_tags",
  stage: "admission_stages",
};

/** Cadastros que têm a coluna `active` (podem ser desativados em vez de excluídos). */
export const SUPPORTS_ACTIVE: Record<CatEntity, boolean> = {
  company: true,
  branch: true,
  position: true,
  documentType: false,
  tag: false,
  stage: true,
};

const SOURCES: Record<CatEntity, Array<{ table: string; column: string; label: [one: string, many: string] }>> = {
  position: [
    { table: "admissions", column: "positionId", label: ["admissão", "admissões"] },
    { table: "admission_template_positions", column: "positionId", label: ["modelo de checklist", "modelos de checklist"] },
  ],
  company: [{ table: "admissions", column: "companyId", label: ["admissão", "admissões"] }],
  branch: [{ table: "admissions", column: "branchId", label: ["admissão", "admissões"] }],
  documentType: [{ table: "admission_attachments", column: "documentTypeId", label: ["anexo", "anexos"] }],
  tag: [{ table: "_AdmissionToAdmissionTag", column: "B", label: ["admissão", "admissões"] }],
  stage: [{ table: "admissions", column: "stageId", label: ["admissão", "admissões"] }],
};

export interface Usage {
  total: number;
  parts: Array<{ label: string; count: number }>;
}

export async function countUsage(supabase: Supabase, entity: CatEntity, id: string): Promise<Usage> {
  const results = await Promise.all(
    SOURCES[entity].map(async (s) => {
      const { count, error } = await supabase
        .from(s.table)
        .select(s.column, { count: "exact", head: true })
        .eq(s.column, id);
      // Na dúvida, trate como "em uso": nunca liberar exclusão por erro de contagem.
      const n = error ? 1 : count ?? 0;
      return { label: n === 1 ? s.label[0] : s.label[1], count: n };
    })
  );
  const parts = results.filter((r) => r.count > 0);
  return { total: parts.reduce((sum, p) => sum + p.count, 0), parts };
}

/** "12 admissões · 2 modelos de checklist" */
export function describeUsage(usage: Usage): string {
  return usage.parts.map((p) => `${p.count} ${p.label}`).join(" · ");
}
