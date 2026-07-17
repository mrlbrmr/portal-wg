import { prisma } from "@/lib/prisma";

/**
 * Instancia os grupos/itens de um modelo de checklist dentro de uma admissão.
 * Soma ao checklist existente (não substitui). Retorna quantos grupos criou.
 * Usado tanto na criação da admissão (auto-aplica o modelo escolhido) quanto
 * no botão "Aplicar modelo" da ficha.
 */
export async function instantiateChecklistFromTemplate(
  admissionId: string,
  templateId: string
): Promise<number> {
  const groups = await prisma.templateGroup.findMany({
    where: { templateId },
    orderBy: { sortOrder: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (groups.length === 0) return 0;

  const last = await prisma.checklistGroup.findFirst({
    where: { admissionId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let order = last?.sortOrder ?? 0;

  await prisma.$transaction(async (tx) => {
    for (const g of groups) {
      order += 1;
      const newGroup = await tx.checklistGroup.create({
        data: { admissionId, name: g.name, sortOrder: order },
        select: { id: true },
      });
      if (g.items.length > 0) {
        await tx.checklistItem.createMany({
          data: g.items.map((it, idx) => ({
            admissionId,
            groupId: newGroup.id,
            name: it.name,
            description: it.description,
            sortOrder: idx + 1,
          })),
        });
      }
    }
  });

  return groups.length;
}
