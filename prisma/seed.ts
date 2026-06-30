// Seed de desenvolvimento — NUNCA usar dados reais de candidatos
import { PrismaClient, UserRole, Modality, ContractType, JobStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@wgbaterias.com.br" },
    update: {},
    create: {
      name: "Admin RH",
      email: "admin@wgbaterias.com.br",
      passwordHash,
      role: UserRole.ADMIN_RH,
    },
  });

  console.log("✅ Usuário admin criado:", admin.email);

  const viewerHash = await bcrypt.hash("viewer123", 12);

  const viewer = await prisma.user.upsert({
    where: { email: "visualizador@wgbaterias.com.br" },
    update: {},
    create: {
      name: "Visualizador RH",
      email: "visualizador@wgbaterias.com.br",
      passwordHash: viewerHash,
      role: UserRole.VIEWER_RH,
    },
  });

  console.log("✅ Usuário visualizador criado:", viewer.email);

  const job1 = await prisma.job.create({
    data: {
      title: "Vendedor Externo",
      department: "Comercial",
      city: "São Paulo",
      state: "SP",
      modality: Modality.PRESENTIAL,
      contractType: ContractType.CLT,
      description: "Buscamos um profissional dinâmico e orientado a resultados para integrar nossa equipe comercial, atuando na prospecção e manutenção de clientes na região de São Paulo.",
      responsibilities: "- Prospectar novos clientes na carteira\n- Visitar clientes ativos e inativos\n- Atingir metas mensais de vendas\n- Elaborar relatórios de visitas\n- Participar de treinamentos de produto",
      requiredRequirements: "- Ensino médio completo\n- Experiência mínima de 1 ano em vendas externas\n- CNH categoria B\n- Veículo próprio\n- Habilidade de negociação",
      desiredRequirements: "- Experiência no setor automotivo ou de baterias\n- Conhecimento em CRM\n- Ensino superior em andamento",
      benefits: "- Salário fixo + comissão\n- VT ou ajuda de custo combustível\n- VR\n- Plano de saúde\n- Seguro de vida",
      workSchedule: "Segunda a Sexta, 08h às 17h48",
      tallyFormUrl: null,
      status: JobStatus.ACTIVE,
    },
  });

  const job2 = await prisma.job.create({
    data: {
      title: "Assistente de RH",
      department: "Gente & Gestão",
      city: "São Paulo",
      state: "SP",
      modality: Modality.HYBRID,
      contractType: ContractType.CLT,
      description: "Oportunidade para profissional de RH atuar em empresa sólida do setor de energia automotiva, apoiando processos de recrutamento, integração e administração de pessoal.",
      responsibilities: "- Apoiar processos seletivos\n- Conduzir integrações de novos colaboradores\n- Administrar documentação de pessoal\n- Apoiar ações de treinamento e desenvolvimento\n- Atender demandas dos colaboradores",
      requiredRequirements: "- Ensino superior em Psicologia, Administração, Gestão de RH ou áreas afins\n- Experiência de pelo menos 6 meses em RH\n- Pacote Office intermediário",
      desiredRequirements: "- Experiência com recrutamento e seleção\n- Conhecimento em sistemas de RH (TOTVS, SAP)\n- Pós-graduação em RH",
      benefits: "- VT\n- VR\n- Plano de saúde\n- Seguro de vida\n- Gympass",
      workSchedule: "Segunda a Sexta, 08h às 17h",
      tallyFormUrl: null,
      status: JobStatus.ACTIVE,
    },
  });

  console.log("✅ Vagas de exemplo criadas:", job1.title, "|", job2.title);

  console.log("\n🎉 Seed concluído!");
  console.log("\n📋 Credenciais de desenvolvimento:");
  console.log("   Admin RH:       admin@wgbaterias.com.br / admin123");
  console.log("   Visualizador:   visualizador@wgbaterias.com.br / viewer123");
  console.log("\n⚠️  ATENÇÃO: Troque essas senhas antes de ir para produção!\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
