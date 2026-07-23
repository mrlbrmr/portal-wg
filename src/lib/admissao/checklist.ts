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
    .select("id, name, sortOrder, items:admission_template_items(id, name, description, sortOrder, parentId)")
    .eq("templateId", templateId)
    .order("sortOrder", { ascending: true });

  const groups = (groupsData ?? []) as unknown as Array<{
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      sortOrder: number;
      parentId: string | null;
    }>;
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

    // Preserva a hierarquia: itens de topo primeiro (guardando o mapa id
    // antigo→novo), depois as subtarefas apontando para o novo pai.
    const items = [...(g.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const topLevel = items.filter((it) => !it.parentId);
    const children = items.filter((it) => it.parentId);
    const idMap = new Map<string, string>();

    for (let idx = 0; idx < topLevel.length; idx++) {
      const it = topLevel[idx];
      const { data: created } = await supabase
        .from("admission_checklist_items")
        .insert({
          admissionId,
          groupId: newGroup.id,
          name: it.name,
          description: it.description,
          sortOrder: idx + 1,
        })
        .select("id")
        .single();
      if (created) idMap.set(it.id, created.id);
    }

    const childRows = children
      .filter((it) => it.parentId && idMap.has(it.parentId))
      .map((it, idx) => ({
        admissionId,
        groupId: newGroup.id,
        parentId: idMap.get(it.parentId!)!,
        name: it.name,
        description: it.description,
        sortOrder: idx + 1,
      }));
    if (childRows.length > 0) {
      await supabase.from("admission_checklist_items").insert(childRows);
    }
  }

  return groups.length;
}
