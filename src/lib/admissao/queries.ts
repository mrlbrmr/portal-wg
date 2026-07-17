import { prisma } from "@/lib/prisma";

// Opções de configuração usadas pelos formulários e filtros de Admissões.
// Só itens ativos, na ordem de exibição definida no cadastro.
export async function getAdmissionConfig() {
  const [stages, companies, branches, positions, templates, users] = await Promise.all([
    prisma.admissionStage.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.company.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.branch.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.position.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.checklistTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { stages, companies, branches, positions, templates, users };
}
