import { prisma } from "@/lib/prisma";
import { PUBLIC_JOB_STATUS_LIST } from "@/lib/job-visibility";

// GET /api/feed/indeed.xml — feed XML no padrão do Indeed (elemento <source>).
// O Indeed (e vários agregadores) rastreiam este feed para listar as vagas
// organicamente. Público, só dados da vaga. Revalida a cada 5 min.
// Spec: https://docs.indeed.com/indeed-apply/xml-feed
export const revalidate = 300;

// contractType (nosso enum) → jobtype aceito pelo Indeed.
const JOB_TYPE: Record<string, string> = {
  CLT: "fulltime",
  PJ: "contract",
  INTERNSHIP: "internship",
  APPRENTICE: "fulltime",
  TEMPORARY: "temporary",
  OTHER: "",
};

// Envolve conteúdo em CDATA, escapando qualquer "]]>" interno.
function cdata(value: string | null | undefined): string {
  const v = (value ?? "").toString();
  return `<![CDATA[${v.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiras.wgbaterias.com.br";
  const now = new Date();

  const jobs = await prisma.job.findMany({
    where: {
      status: { in: PUBLIC_JOB_STATUS_LIST },
      OR: [{ closingDate: null }, { closingDate: { gte: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      responsibilities: true,
      requiredRequirements: true,
      desiredRequirements: true,
      benefits: true,
      department: true,
      company: true,
      city: true,
      state: true,
      salaryRange: true,
      contractType: true,
      createdAt: true,
    },
  });

  const jobsXml = jobs
    .map((job) => {
      const url = `${baseUrl}/vagas/${job.slug ?? job.id}`;
      const jobType = JOB_TYPE[job.contractType] ?? "";

      // Descrição rica: junta as seções em HTML (o Indeed aceita HTML no CDATA).
      const descParts = [
        job.description,
        `<h3>Responsabilidades</h3>${job.responsibilities}`,
        `<h3>Requisitos</h3>${job.requiredRequirements}`,
        job.desiredRequirements ? `<h3>Diferenciais</h3>${job.desiredRequirements}` : "",
        job.benefits ? `<h3>Benefícios</h3>${job.benefits}` : "",
      ].filter(Boolean);

      return [
        "  <job>",
        `    <title>${cdata(job.title)}</title>`,
        `    <date>${cdata(job.createdAt.toUTCString())}</date>`,
        `    <referencenumber>${cdata(job.id)}</referencenumber>`,
        `    <url>${cdata(url)}</url>`,
        `    <company>${cdata(job.company ?? "Grupo WG Baterias")}</company>`,
        `    <city>${cdata(job.city)}</city>`,
        `    <state>${cdata(job.state)}</state>`,
        `    <country>${cdata("BR")}</country>`,
        job.department ? `    <category>${cdata(job.department)}</category>` : "",
        job.salaryRange ? `    <salary>${cdata(job.salaryRange)}</salary>` : "",
        jobType ? `    <jobtype>${cdata(jobType)}</jobtype>` : "",
        `    <description>${cdata(descParts.join(""))}</description>`,
        "  </job>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<source>",
    `  <publisher>${cdata("Grupo WG Baterias")}</publisher>`,
    `  <publisherurl>${cdata(baseUrl)}</publisherurl>`,
    `  <lastBuildDate>${cdata(now.toUTCString())}</lastBuildDate>`,
    jobsXml,
    "</source>",
  ].join("\n");

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
