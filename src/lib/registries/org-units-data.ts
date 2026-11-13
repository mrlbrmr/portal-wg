// Leitura dos cadastros de Filiais e Áreas para os selects da solicitação e da vaga.
// Aceita o client da sessão (painel, respeita RLS) ou o admin (formulário público).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgUnit } from "./org-units";

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
