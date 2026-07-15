import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import JobForm from "@/components/internal/JobForm";
import { JOB_STATUS_LABELS, formatDateTime } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Editar Vaga — RH" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarVagaPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      statusHistory: { orderBy: { changedAt: "desc" } },
    },
  });
  if (!job) notFound();

  const statusBadge: Record<string, string> = {
    DRAFT: "bg-blue-500/10 text-blue-400",
    ACTIVE: "bg-wg-green/10 text-wg-green",
    SCREENING: "bg-amber-500/10 text-amber-400",
    INTERVIEW: "bg-purple-500/10 text-purple-400",
    ADMISSION: "bg-cyan-500/10 text-cyan-400",
    PAUSED: "bg-orange-500/10 text-orange-400",
    CLOSED: "bg-wg-border text-wg-gray",
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Editar Vaga</h1>
      <div className="bg-wg-card border border-wg-border rounded-xl p-6 mb-6">
        <JobForm job={job} />
      </div>

      {job.statusHistory.length > 0 && (
        <div className="bg-wg-card border border-wg-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-wg-gray uppercase tracking-wider mb-4">
            Histórico de status
          </h2>
          <div className="flex flex-col gap-3">
            {job.statusHistory.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[entry.status] ?? "bg-wg-border text-wg-gray"}`}>
                    {JOB_STATUS_LABELS[entry.status] ?? entry.status}
                  </span>
                  <span className="text-wg-gray">por {entry.changedBy}</span>
                </div>
                <span className="text-xs text-wg-gray">{formatDateTime(entry.changedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
