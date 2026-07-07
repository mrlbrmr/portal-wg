import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { JOB_STATUS_LABELS, MODALITY_LABELS, formatDate } from "@/lib/utils";
import { Plus, ExternalLink } from "lucide-react";
import { JobActions } from "@/components/internal/JobActions";
import { JobSortFilter } from "@/components/internal/JobSortFilter";
import type { Metadata } from "next";
import { JobStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Gerenciar Vagas — RH" };

type OrderBy =
  | { createdAt: "asc" | "desc" }
  | { city: "asc" | "desc" }
  | { state: "asc" | "desc" }
  | { title: "asc" | "desc" };

const SORT_MAP: Record<string, OrderBy> = {
  date_desc: { createdAt: "desc" },
  date_asc:  { createdAt: "asc" },
  city_asc:  { city: "asc" },
  state_asc: { state: "asc" },
  title_asc: { title: "asc" },
};

export default async function GerenciarVagasPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; status?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);

  const sortKey = params.sort && SORT_MAP[params.sort] ? params.sort : "date_desc";
  const orderBy = SORT_MAP[sortKey];

  const where: Record<string, unknown> = {};
  const rawStatus = params.status;
  if (rawStatus && Object.values(JobStatus).includes(rawStatus as JobStatus)) {
    where.status = rawStatus as JobStatus;
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy,
    take: 200,
  });

  const statusBadge: Record<string, string> = {
    ACTIVE: "bg-wg-green/10 text-wg-green",
    PAUSED: "bg-yellow-500/10 text-yellow-400",
    CLOSED: "bg-wg-border text-wg-gray",
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-white">Vagas</h1>
        {session?.user.role === "ADMIN_RH" && (
          <Link
            href="/vagas/nova"
            className="flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova vaga
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <JobSortFilter />
        <span className="text-xs text-wg-gray">
          {jobs.length} {jobs.length === 1 ? "vaga" : "vagas"}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {jobs.length === 0 && (
          <div className="text-center py-16 text-wg-gray">
            Nenhuma vaga encontrada.
          </div>
        )}

        {jobs.map((job) => (
          <div
            key={job.id}
            className="bg-wg-card border border-wg-border rounded-xl p-5 flex items-start justify-between gap-4 hover:border-wg-green/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-semibold text-white">{job.title}</h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[job.status]}`}
                >
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </div>
              <div className="text-sm text-wg-gray flex flex-wrap gap-3">
                <span>{job.city} / {job.state}</span>
                <span>·</span>
                <span>{MODALITY_LABELS[job.modality]}</span>
                {job.department && (
                  <>
                    <span>·</span>
                    <span>{job.department}</span>
                  </>
                )}
                <span>·</span>
                <span>Criada em {formatDate(job.createdAt)}</span>
              </div>
              {!job.tallyFormUrl && job.status === "ACTIVE" && (
                <p className="text-xs text-yellow-500 mt-1.5">
                  ⚠ Link do Tally não configurado
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {job.status === "ACTIVE" && (
                <Link
                  href={`/vagas/${job.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-wg-gray hover:text-wg-green transition-colors"
                  title="Ver vaga pública"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              )}

              {session?.user.role === "ADMIN_RH" && (
                <>
                  <Link
                    href={`/vagas/${job.id}/editar`}
                    className="text-sm border border-wg-border hover:border-wg-green/50 text-wg-gray hover:text-wg-green px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Editar
                  </Link>
                  <JobActions
                    jobId={job.id}
                    jobTitle={job.title}
                    status={job.status}
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
