import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Opções de configuração usadas pelos formulários e filtros de Admissões.
// Só itens ativos, na ordem de exibição definida no cadastro.
// cache() deduplica chamadas simultâneas dentro da mesma requisição —
// evita que várias sub-árvores de Server Components disparem as queries.
export const getAdmissionConfig = cache(async function getAdmissionConfig() {
  const supabase = await createClient();
  const [stages, companies, branches, positions, users] = await Promise.all([
    supabase
      .from("admission_stages")
      .select("id, name, color")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
    supabase
      .from("admission_companies")
      .select("id, name")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
    supabase
      .from("admission_branches")
      .select("id, name")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
    supabase
      .from("admission_positions")
      .select("id, name")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
    supabase
      .from("users")
      .select("id, name")
      .eq("active", true)
      .order("name", { ascending: true }),
  ]);
  return {
    stages: (stages.data ?? []) as Array<{ id: string; name: string; color: string }>,
    companies: (companies.data ?? []) as Array<{ id: string; name: string }>,
    branches: (branches.data ?? []) as Array<{ id: string; name: string }>,
    positions: (positions.data ?? []) as Array<{ id: string; name: string }>,
    users: (users.data ?? []) as Array<{ id: string; name: string }>,
  };
});
