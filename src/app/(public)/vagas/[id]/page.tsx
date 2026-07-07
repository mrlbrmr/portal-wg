import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/sanitize";
import { MapPin, Clock, Briefcase, ChevronLeft, ExternalLink, Mail, ArrowRight } from "lucide-react";
import { ShareButton } from "@/components/public/ShareButton";
import type { Metadata } from "next";
import { cache } from "react";

// ISR: revalida automaticamente a cada 60s; revalidatePath() em edições força imediato
export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

// cache() deduplica a query dentro do mesmo request (compartilhada entre generateMetadata e JobPage)
const findJob = cache(async (slugOrId: string) => {
  return prisma.job.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
  });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = await findJob(id);
  if (!job) return { title: "Vaga não encontrada" };
  return {
    title: `${job.title} — ${job.city}/${job.state}`,
    description: `Vaga de ${job.title}${job.department ? ` em ${job.department}` : ""} no Grupo WG Baterias em ${job.city}/${job.state}. Candidate-se agora!`,
    openGraph: {
      title: `${job.title} — Carreiras WG`,
      description: `Oportunidade em ${job.city}/${job.state}. Faça parte do Grupo WG!`,
    },
  };
}

export default async function JobPage({ params }: Props) {
  const { id } = await params;
  const job = await findJob(id);
  if (!job) notFound();

  const now = new Date();
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiraswg.vercel.app";
  const jobUrl = `${baseUrl}/vagas/${job.slug ?? job.id}`;

  // Vagas similares — mesmo departamento OU mesma cidade, excluindo a atual
  const similarWhere = {
    id: { not: job.id },
    status: "ACTIVE" as const,
    AND: [
      { OR: [{ closingDate: null }, { closingDate: { gte: now } }] },
      ...(job.department
        ? [{ OR: [{ department: job.department }, { city: job.city }] }]
        : [{ city: job.city }]),
    ],
  };
  const similar = await prisma.job.findMany({
    where: similarWhere,
    take: 3,
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true, city: true, state: true, modality: true, department: true },
  });

  // JSON-LD JobPosting — melhora visibilidade no Google
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    hiringOrganization: {
      "@type": "Organization",
      name: job.company ?? "Grupo WG Baterias",
      sameAs: "https://www.wgbaterias.com.br",
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city,
        addressRegion: job.state,
        addressCountry: "BR",
      },
    },
    employmentType: job.contractType === "CLT" ? "FULL_TIME" : "CONTRACTOR",
    datePosted: job.createdAt.toISOString().split("T")[0],
    ...(job.closingDate && { validThrough: job.closingDate.toISOString().split("T")[0] }),
    ...(job.salaryRange && {
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "BRL",
        value: { "@type": "QuantitativeValue", description: job.salaryRange },
      },
    }),
    url: jobUrl,
    ...(job.tallyFormUrl && { applicationContact: { "@type": "ContactPoint", url: job.tallyFormUrl } }),
  };

  const sections = [
    { title: "Sobre a Vaga", content: job.description },
    { title: "Responsabilidades", content: job.responsibilities },
    { title: "Requisitos Obrigatórios", content: job.requiredRequirements },
    ...(job.desiredRequirements
      ? [{ title: "Requisitos Desejáveis", content: job.desiredRequirements }]
      : []),
    ...(job.benefits ? [{ title: "Benefícios", content: job.benefits }] : []),
  ];

  return (
    <>
      {/* Structured data para Google Jobs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 py-10">
          {/* Breadcrumb */}
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-wg-green hover:text-wg-green-bright transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar às vagas
          </Link>

          {/* Cabeçalho */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
                {job.department && (
                  <span className="text-sm text-gray-500">{job.department}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ShareButton url={jobUrl} />
                {job.tallyFormUrl ? (
                  <a
                    href={job.tallyFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-semibold px-5 py-2.5 rounded-full transition-colors"
                  >
                    Candidatar-se
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <a
                    href="mailto:carreiras@wgbaterias.com.br"
                    className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-semibold px-5 py-2.5 rounded-full transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Enviar currículo
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-wg-green" />
                {job.city} / {job.state}
              </span>
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-wg-green" />
                {MODALITY_LABELS[job.modality]} · {CONTRACT_TYPE_LABELS[job.contractType]}
              </span>
              {job.workSchedule && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-wg-green" />
                  {job.workSchedule}
                </span>
              )}
            </div>
          </div>

          {/* Seções */}
          {sections.map((section) => (
            <div
              key={section.title}
              className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm"
            >
              <h2 className="text-base font-semibold text-gray-900 mb-3">{section.title}</h2>
              <div
                className="rich-text text-sm text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(section.content) }}
              />
            </div>
          ))}

          {/* CTA final */}
          <div className="bg-wg-green/5 border border-wg-green/25 rounded-2xl p-8 text-center mt-2">
            <p className="text-gray-600 mb-5">
              Tem o perfil que buscamos? Envie sua candidatura agora!
            </p>
            {job.tallyFormUrl ? (
              <a
                href={job.tallyFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-bold px-8 py-3.5 rounded-full transition-colors shadow-lg shadow-wg-green/20"
              >
                Candidatar-se a esta vaga
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <a
                href="mailto:carreiras@wgbaterias.com.br"
                className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-bold px-8 py-3.5 rounded-full transition-colors"
              >
                <Mail className="w-4 h-4" />
                Enviar currículo por e-mail
              </a>
            )}
          </div>

          {/* Vagas similares */}
          {similar.length > 0 && (
            <div className="mt-10">
              <h2 className="text-base font-semibold text-gray-700 mb-4">Outras oportunidades</h2>
              <div className="flex flex-col gap-3">
                {similar.map((s) => (
                  <Link
                    key={s.id}
                    href={`/vagas/${s.slug ?? s.id}`}
                    className="flex items-center justify-between bg-white border border-gray-200 hover:border-wg-green/40 rounded-xl px-5 py-4 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-wg-green transition-colors">
                        {s.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {s.city} / {s.state}
                        {s.department ? ` · ${s.department}` : ""}
                        {" · "}
                        {MODALITY_LABELS[s.modality]}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-wg-green transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
