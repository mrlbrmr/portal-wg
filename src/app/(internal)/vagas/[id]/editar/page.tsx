import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job, JobStatusHistory, JobPublication } from "@/types/domain";
import { redirect, notFound } from "next/navigation";
import JobForm from "@/components/internal/JobForm";
import { JOB_STATUS_LABELS, formatDateTime, isPublicJobStatus } from "@/lib/utils";
import {
  DistributionPanel,
  type PublicationView,
} from "@/components/internal/DistributionPanel";
import { buildAnnouncementText, jobPublicUrl } from "@/lib/distribution/dispatch";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Editar Vaga — RH" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarVagaPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const { data: jobRaw } = await supabase
    .from("jobs")
    .select("*, statusHistory:job_status_history(*), publications:job_publications(*)")
    .eq("id", id)
    .order("changedAt", { referencedTable: "job_status_history", ascending: false })
    .limit(20, { referencedTable: "job_publications" })
    .maybeSingle();
  const job = jobRaw as unknown as
    | (Job & {
        statusHistory: JobStatusHistory[];
        // supabase-js devolve timestamps como string (não Date do Prisma)
        publications: (Omit<JobPublication, "postedAt"> & { postedAt: string | null })[];
      })
    | null;
  if (!job) notFound();

  const isPublic = isPublicJobStatus(job.status);
  const announcementText = buildAnnouncementText({
    id: job.id,
    title: job.title,
    slug: job.slug,
    city: job.city,
    state: job.state,
    department: job.department,
    company: job.company,
    modality: job.modality,
    contractType: job.contractType,
    salaryRange: job.salaryRange,
    highlightBenefit: job.highlightBenefit,
    url: jobPublicUrl(job.slug ?? job.id),
  });
  const publications: PublicationView[] = job.publications.map((p) => ({
    channel: p.channel,
    status: p.status,
    externalUrl: p.externalUrl,
    lastError: p.lastError,
    postedAt: p.postedAt ?? null,
  }));

  const statusBadge: Record<string, string> = {
    DRAFT: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-wg-green/15 text-wg-green-dark",
    SCREENING: "bg-amber-100 text-amber-700",
    INTERVIEW: "bg-purple-100 text-purple-700",
    ADMISSION: "bg-cyan-100 text-cyan-700",
    PAUSED: "bg-orange-100 text-orange-700",
    CLOSED: "bg-gray-200 text-gray-600",
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Vaga</h1>
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-6">
        <JobForm job={job} />
      </div>

      <div className="mb-6">
        <DistributionPanel
          jobId={job.id}
          jobUrl={jobPublicUrl(job.slug ?? job.id)}
          isPublic={isPublic}
          publications={publications}
          announcementText={announcementText}
        />
      </div>

      {job.statusHistory.length > 0 && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Histórico de status
          </h2>
          <div className="flex flex-col gap-3">
            {job.statusHistory.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[entry.status] ?? "bg-gray-200 text-gray-600"}`}>
                    {JOB_STATUS_LABELS[entry.status] ?? entry.status}
                  </span>
                  <span className="text-gray-500">por {entry.changedBy}</span>
                </div>
                <span className="text-xs text-gray-500">{formatDateTime(entry.changedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
