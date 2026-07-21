import { createClient } from "@/lib/supabase/server";

/**
 * Instancia os grupos/itens de um modelo de checklist dentro de uma admissão.
 * Soma ao checklist existente (não substitui). Retorna quantos grupos criou.
 * Usado tanto na criação da admissão (auto-aplica o modelo escolhido) quanto
 * no botão "Aplicar modelo" da ficha.
 *
 * Sem transação (supabase-js não expõe transações client-side): os inserts são
 * sequenciais. Como a operação apenas *adiciona* grupos/itens, uma falha parcial
 * é recuperável reaplicando o modelo.
 */
export async function instantiateChecklistFromTemplate(
  admissionId: string,
  templateId: string
): Promise<number> {
  const supabase = await createClient();

  const { data: groupsData } = await supabase
    .from("admission_template_groups")
    .select("id, name, sortOrder, items:admission_template_items(id, name, description, sortOrder)")
    .eq("templateId", templateId)
    .order("sortOrder", { ascending: true });

  const groups = (groupsData ?? []) as unknown as Array<{
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{ id: string; name: string; description: string | null; sortOrder: number }>;
  }>;
  if (groups.length === 0) return 0;

  const { data: last } = await supabase
    .from("admission_checklist_groups")
    .select("sortOrder")
    .eq("admissionId", admissionId)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();
  let order = (last?.sortOrder as number | undefined) ?? 0;

  for (const g of groups) {
    order += 1;
    const { data: newGroup } = await supabase
      .from("admission_checklist_groups")
      .insert({ admissionId, name: g.name, sortOrder: order })
      .select("id")
      .single();
    if (!newGroup) continue;

    const items = [...(g.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    if (items.length > 0) {
      await supabase.from("admission_checklist_items").insert(
        items.map((it, idx) => ({
          admissionId,
          groupId: newGroup.id,
          name: it.name,
          description: it.description,
          sortOrder: idx + 1,
        }))
      );
    }
  }

  return groups.length;
}
