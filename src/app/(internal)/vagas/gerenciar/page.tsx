import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { JOB_STATUS_LABELS, MODALITY_LABELS, formatDate } from "@/lib/utils";
import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gerenciar Vagas — RH" };

export default async function GerenciarVagasPage() {
  const session = await auth();

  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    PAUSED: "bg-yellow-100 text-yellow-700",
    CLOSED: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vagas</h1>
        {session?.user.role === "ADMIN_RH" && (
          <Link
            href="/vagas/nova"
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova vaga
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {jobs.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            Nenhuma vaga cadastrada ainda.
          </div>
        )}

        {jobs.map((job) => (
          <div
            key={job.id}
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-semibold text-gray-900">{job.title}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[job.status]}`}>
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </div>
              <div className="text-sm text-gray-500 flex flex-wrap gap-3">
                <span>{job.city} / {job.state}</span>
                <span>·</span>
                <span>{MODALITY_LABELS[job.modality]}</span>
                {job.department && <><span>·</span><span>{job.department}</span></>}
                <span>·</span>
                <span>Criada em {formatDate(job.createdAt)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                href={`/candidatos?jobId=${job.id}`}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-orange-600"
              >
                <Users className="w-4 h-4" />
                {job._count.applications}
              </Link>

              {session?.user.role === "ADMIN_RH" && (
                <Link
                  href={`/vagas/${job.id}/editar`}
                  className="text-sm border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-600 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Editar
                </Link>
              )}

              <Link
                href={`/candidatos?jobId=${job.id}`}
                className="text-sm bg-orange-50 hover:bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg transition-colors"
              >
                Ver candidatos
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
