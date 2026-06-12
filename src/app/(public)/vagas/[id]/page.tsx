import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import { MapPin, Clock, Briefcase, ChevronLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id, status: "ACTIVE" },
    select: { title: true, city: true, state: true },
  });
  if (!job) return { title: "Vaga não encontrada" };
  return {
    title: `${job.title} — ${job.city}/${job.state}`,
    description: `Vaga de ${job.title} no Grupo WG Baterias em ${job.city}/${job.state}. Candidate-se agora!`,
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar às vagas
      </Link>

      {/* Cabeçalho da vaga */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
            {job.department && (
              <span className="text-sm text-gray-500">{job.department}</span>
            )}
          </div>
          <Link
            href={`/candidatar?jobId=${job.id}`}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Candidatar-se
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-orange-500" />
            {job.city} / {job.state}
          </span>
          <span className="flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-orange-500" />
            {MODALITY_LABELS[job.modality]} · {CONTRACT_TYPE_LABELS[job.contractType]}
          </span>
          {job.workSchedule && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-orange-500" />
              {job.workSchedule}
            </span>
          )}
        </div>
      </div>

      {/* Seções da vaga */}
      {sections.map((section) => (
        <div key={section.title} className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h2>
          <div className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">
            {section.content}
          </div>
        </div>
      ))}

      {/* CTA final */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center">
        <p className="text-gray-700 mb-4">
          Tem o perfil que buscamos? Envie sua candidatura agora!
        </p>
        <Link
          href={`/candidatar?jobId=${job.id}`}
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          Candidatar-se a esta vaga
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-xs text-gray-400 mt-3">
          Seus dados serão tratados com sigilo, conforme nosso{" "}
          <Link href="/privacidade" className="underline hover:text-orange-500">
            Aviso de Privacidade
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
