// Gera o JSON-LD schema.org/JobPosting de uma vaga — usado tanto na página
// pública (Google for Jobs lê os dados estruturados da página) quanto no feed
// `/api/feed/jobs`. Mantém uma única fonte de verdade do markup.
//
// Referência de campos: https://developers.google.com/search/docs/appearance/structured-data/job-posting

export interface JobForSchema {
  id: string;
  title: string;
  slug: string | null;
  description: string;
  city: string | null;
  state: string | null;
  department: string | null;
  company: string | null;
  modality: string;
  contractType: string;
  salaryRange: string | null;
  // Aceita Date (Prisma) ou string ISO (supabase-js) — normalizado com new Date().
  createdAt: Date | string;
  closingDate: Date | string | null;
}

// contractType (nosso enum) → employmentType aceito pelo Google.
const EMPLOYMENT_TYPE: Record<string, string> = {
  CLT: "FULL_TIME",
  PJ: "CONTRACTOR",
  INTERNSHIP: "INTERN",
  APPRENTICE: "OTHER",
  TEMPORARY: "TEMPORARY",
  OTHER: "OTHER",
};

/**
 * Tenta extrair min/max de uma faixa salarial em texto livre pt-BR
 * (ex.: "R$ 2.500 – R$ 3.000", "Até R$ 3.000"). Retorna null se não achar números.
 */
export function parseSalaryRange(raw: string): { min: number; max: number } | null {
  const matches = raw.match(/\d[\d.,]*/g);
  if (!matches) return null;
  const nums = matches
    .map((m) => parseFloat(m.replace(/\./g, "").replace(",", ".")))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export function buildJobPostingJsonLd(
  job: JobForSchema,
  baseUrl: string
): Record<string, unknown> {
  const jobUrl = `${baseUrl}/vagas/${job.slug ?? job.id}`;
  const plainDesc = job.description
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const orgName = job.company ?? "Grupo WG Baterias";
  const salary = job.salaryRange ? parseSalaryRange(job.salaryRange) : null;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: plainDesc,
    identifier: {
      "@type": "PropertyValue",
      name: orgName,
      value: job.id,
    },
    hiringOrganization: {
      "@type": "Organization",
      name: orgName,
      sameAs: "https://www.wgbaterias.com.br",
      logo: `${baseUrl}/icon.png`,
    },
    ...(job.city || job.state
      ? {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              ...(job.city ? { addressLocality: job.city } : {}),
              ...(job.state ? { addressRegion: job.state } : {}),
              addressCountry: "BR",
            },
          },
        }
      : {}),
    employmentType: EMPLOYMENT_TYPE[job.contractType] ?? "OTHER",
    datePosted: new Date(job.createdAt).toISOString().split("T")[0],
    url: jobUrl,
    directApply: true,
  };

  if (job.closingDate) {
    jsonLd.validThrough = new Date(job.closingDate).toISOString().split("T")[0];
  }

  // Remoto: Google exige jobLocationType + applicantLocationRequirements.
  if (job.modality === "REMOTE") {
    jsonLd.jobLocationType = "TELECOMMUTE";
    jsonLd.applicantLocationRequirements = { "@type": "Country", name: "BR" };
  }

  if (salary) {
    jsonLd.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "BRL",
      value: {
        "@type": "QuantitativeValue",
        ...(salary.min === salary.max
          ? { value: salary.min }
          : { minValue: salary.min, maxValue: salary.max }),
        unitText: "MONTH",
      },
    };
  } else if (job.salaryRange) {
    // Sem números parseáveis: mantém a faixa como texto descritivo.
    jsonLd.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "BRL",
      value: {
        "@type": "QuantitativeValue",
        description: job.salaryRange,
        unitText: "MONTH",
      },
    };
  }

  return jsonLd;
}
