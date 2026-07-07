import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/sanitize";
import { MapPin, Clock, Briefcase, ChevronLeft, ExternalLink, Mail } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id, status: "ACTIVE" },
    select: { title: true, city: true, state: true, department: true },
  });
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
  const job = await prisma.job.findUnique({
    where: { id, status: "ACTIVE" },
  });

  if (!job) notFound();

  const sections = [
    { title: "Sobre a Vaga", content: job.description },
    { title: "Responsabilidades", content: job.responsibilities },
    { title: "Requisitos Obrigatórios", content: job.requiredRequirements },
    ...(job.desiredRequirements
      ? [{ title: "Requisitos Desejáveis", content: job.desiredRequirements }]
      : []),
    ...(job.benefits
      ? [{ title: "Benefícios", content: job.benefits }]
      : []),
  ];

  return (
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

        {/* Cabeçalho da vaga */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
              {job.department && (
                <span className="text-sm text-gray-500">{job.department}</span>
              )}
            </div>
            {job.tallyFormUrl && (
              <a
                href={job.tallyFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-semibold px-5 py-2.5 rounded-full transition-colors"
              >
                Candidatar-se
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
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

        {/* Seções da vaga */}
        {sections.map((section) => (
          <div key={section.title} className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm">
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
      </div>
    </div>
  );
}
