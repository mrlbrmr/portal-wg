import { prisma } from "@/lib/prisma";
import ApplicationForm from "@/components/public/ApplicationForm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  searchParams: Promise<{ jobId?: string }>;
}

export const metadata: Metadata = {
  title: "Candidatar-se",
  robots: { index: false },
};

export default async function CandidatarPage({ searchParams }: Props) {
  const { jobId } = await searchParams;

  let job = null;
  if (jobId) {
    job = await prisma.job.findUnique({
      where: { id: jobId, status: "ACTIVE" },
      select: { id: true, title: true, city: true, state: true },
    });
    if (!job) notFound();
  }

  // Listar vagas ativas para o select (caso acesse sem jobId)
  const activeJobs = await prisma.job.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, title: true, city: true, state: true },
    orderBy: { title: "asc" },
  });

  if (activeJobs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 text-lg">
          Não há vagas abertas no momento. Volte em breve!
        </p>
        <Link href="/" className="text-orange-600 underline mt-4 inline-block">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={job ? `/vagas/${job.id}` : "/"}
        className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        {job ? `Voltar para ${job.title}` : "Voltar às vagas"}
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Enviar Candidatura</h1>
        {job && (
          <p className="text-gray-500 text-sm mb-6">
            Vaga: <strong>{job.title}</strong> · {job.city}/{job.state}
          </p>
        )}

        <ApplicationForm preselectedJobId={job?.id} jobs={activeJobs} />
      </div>
    </div>
  );
}
