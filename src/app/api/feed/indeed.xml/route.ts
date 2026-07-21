import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_JOB_STATUS_LIST } from "@/lib/job-visibility";
import { getAppBaseUrl } from "@/lib/app-url";

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
  const baseUrl = getAppBaseUrl();
  const now = new Date();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, title, slug, description, responsibilities, requiredRequirements, desiredRequirements, benefits, department, company, city, state, salaryRange, contractType, createdAt"
    )
    .in("status", PUBLIC_JOB_STATUS_LIST as readonly string[])
    .or(`closingDate.is.null,closingDate.gte.${now.toISOString()}`)
    .order("createdAt", { ascending: false });

  const jobs = (data ?? []) as Array<{
    id: string;
    title: string;
    slug: string | null;
    description: string;
    responsibilities: string;
    requiredRequirements: string;
    desiredRequirements: string | null;
    benefits: string | null;
    department: string | null;
    company: string | null;
    city: string;
    state: string;
    salaryRange: string | null;
    contractType: string;
    createdAt: string;
  }>;

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
        `    <date>${cdata(new Date(job.createdAt).toUTCString())}</date>`,
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
