// Leitura dos cadastros de Filiais e Áreas para os selects da solicitação e da vaga.
// Aceita o client da sessão (painel, respeita RLS) ou o admin (formulário público).

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrgUnits, type OrgUnit } from "./org-units";

export async function loadOrgUnits(client: SupabaseClient): Promise<{ branches: OrgUnit[]; areas: OrgUnit[] }> {
  const [branchesRes, areasRes] = await Promise.all([
    client.from("admission_branches").select("id, name, active, city, state").order("sortOrder", { ascending: true }),
    client.from("admission_areas").select("id, name, active").order("sortOrder", { ascending: true }),
  ]);
  return {
    branches: (branchesRes.data ?? []) as OrgUnit[],
    areas: (areasRes.data ?? []) as OrgUnit[],
  };
}

/**
 * Vaga (POST/PATCH): com `branchId`/`areaId` no corpo, grava o NOME do cadastro em
 * company/department. Sem os campos, não mexe (corpo parcial do PATCH). Banco de talentos
 * não tem filial.
 */
export async function applyJobOrgUnits(
  client: SupabaseClient,
  body: {
    branchId?: string | null;
    areaId?: string | null;
    company?: string | null;
    department?: string | null;
    isTalentPool?: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (body.isTalentPool) body.branchId = null;
  if (body.branchId === undefined && body.areaId === undefined) return { ok: true };
  const { branches, areas } = await loadOrgUnits(client);
  const r = resolveOrgUnits(
    {
      branchId: body.branchId,
      areaId: body.areaId,
      legacyLocation: body.company ?? null,
      legacyDepartment: body.department ?? null,
    },
    branches,
    areas,
    { requireIds: false }
  );
  if (!r.ok) return { ok: false, error: r.message };
  if (body.branchId !== undefined) {
    body.branchId = r.branchId;
    if (r.branchId) body.company = r.location;
  }
  if (body.areaId !== undefined) {
    body.areaId = r.areaId;
    if (r.areaId) body.department = r.department;
  }
  return { ok: true };
}
