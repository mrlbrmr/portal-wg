import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  formatDate,
} from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Candidatos — RH" };

interface Props {
  searchParams: Promise<{ jobId?: string; status?: string; page?: string }>;
}

const PAGE_SIZE = 20;

export default async function CandidatosPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const where: Record<string, unknown> = {};

  if (params.jobId) where.jobId = params.jobId;
  if (params.status) where.status = params.status;

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        candidate: { select: { fullName: true, email: true, city: true, state: true } },
        job: { select: { title: true } },
        aiReview: { select: { id: true } },
      },
    }),
    prisma.application.count({ where }),
  ]);

  const jobs = await prisma.job.findMany({
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Candidatos
          {total > 0 && <span className="text-gray-400 text-base font-normal ml-2">({total})</span>}
        </h1>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <form className="flex flex-wrap gap-3">
          <select
            name="jobId"
            defaultValue={params.jobId || ""}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todas as vagas</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>

          <select
            name="status"
            defaultValue={params.status || ""}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos os status</option>
            {Object.entries(APPLICATION_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <button
            type="submit"
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            Filtrar
          </button>

          {(params.jobId || params.status) && (
            <Link
              href="/candidatos"
              className="text-sm text-orange-600 hover:underline flex items-center"
            >
              Limpar
            </Link>
          )}
        </form>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {applications.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            Nenhuma candidatura encontrada.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Candidato</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Vaga</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">IA</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-gray-900">{app.candidate.fullName}</div>
                    <div className="text-xs text-gray-400">{app.candidate.city}/{app.candidate.state}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-gray-600">{app.job.title}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-gray-400">{formatDate(app.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${APPLICATION_STATUS_COLORS[app.status]}`}>
                      {APPLICATION_STATUS_LABELS[app.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {app.aiReview ? (
                      <span className="text-xs text-green-600">✓</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/candidatos/${app.id}`}
                      className="text-sm text-orange-600 hover:underline font-medium"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-5">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/candidatos?${new URLSearchParams({ ...params, page: String(p) }).toString()}`}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                p === page
                  ? "bg-orange-500 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
