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

  const descVendedor = "<p>Buscamos um profissional dinâmico e orientado a resultados para integrar nossa equipe comercial, atuando na prospecção e manutenção de clientes na região de São Paulo.</p>";
  const respVendedor = "<ul><li>Prospectar novos clientes na carteira</li><li>Visitar clientes ativos e inativos</li><li>Atingir metas mensais de vendas</li><li>Elaborar relatórios de visitas</li><li>Participar de treinamentos de produto</li></ul>";
  const reqVendedor = "<ul><li>Ensino médio completo</li><li>Experiência mínima de 1 ano em vendas externas</li><li>CNH categoria B e veículo próprio</li><li>Habilidade de negociação</li></ul>";

  const job1 = await prisma.job.upsert({
    where: { id: "seed-vendedor-externo" },
    update: {},
    create: {
      id: "seed-vendedor-externo",
      title: "Vendedor Externo",
      department: "Comercial",
      city: "São Paulo",
      state: "SP",
      modality: Modality.PRESENTIAL,
      contractType: ContractType.CLT,
      description: descVendedor,
      responsibilities: respVendedor,
      requiredRequirements: reqVendedor,
      desiredRequirements: "<ul><li>Experiência no setor automotivo ou de baterias</li><li>Conhecimento em CRM</li></ul>",
      benefits: "<ul><li>Salário fixo + comissão</li><li>VT ou ajuda de custo combustível</li><li>VR</li><li>Plano de saúde</li><li>Seguro de vida</li></ul>",
      workSchedule: "Segunda a Sexta, 08h às 17h48",
      status: JobStatus.ACTIVE,
    },
  });

  const descRH = "<p>Oportunidade para profissional de RH atuar em empresa sólida do setor de energia automotiva, apoiando processos de recrutamento, integração e administração de pessoal.</p>";
  const respRH = "<ul><li>Apoiar processos seletivos</li><li>Conduzir integrações de novos colaboradores</li><li>Administrar documentação de pessoal</li><li>Apoiar ações de treinamento e desenvolvimento</li></ul>";
  const reqRH = "<ul><li>Ensino superior em Psicologia, Administração, Gestão de RH ou áreas afins</li><li>Experiência de pelo menos 6 meses em RH</li><li>Pacote Office intermediário</li></ul>";

  const job2 = await prisma.job.upsert({
    where: { id: "seed-assistente-rh" },
    update: {},
    create: {
      id: "seed-assistente-rh",
      title: "Assistente de RH",
      department: "Gente & Gestão",
      city: "São Paulo",
      state: "SP",
      modality: Modality.HYBRID,
      contractType: ContractType.CLT,
      description: descRH,
      responsibilities: respRH,
      requiredRequirements: reqRH,
      desiredRequirements: "<ul><li>Experiência com recrutamento e seleção</li><li>Conhecimento em sistemas de RH (TOTVS, SAP)</li></ul>",
      benefits: "<ul><li>VT</li><li>VR</li><li>Plano de saúde</li><li>Seguro de vida</li><li>Gympass</li></ul>",
      workSchedule: "Segunda a Sexta, 08h às 17h",
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
