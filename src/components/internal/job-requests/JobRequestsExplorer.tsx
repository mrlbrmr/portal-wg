"use client";

// Listagem do módulo de Solicitações de Vaga: KPIs da fila, busca, filtros combináveis e
// tabela. Cada linha abre a solicitação — as decisões acontecem lá, não aqui, porque o
// fluxo agora tem etapas (validação do RH → aprovação) e comentário obrigatório.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, FileDown, Hourglass, Inbox, Search, SlidersHorizontal, Target, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { JobRequestStatusBadge } from "@/components/internal/job-requests/JobRequestStatusBadge";
import {
  JOB_REQUEST_REASON_LABELS,
  JOB_REQUEST_SLA_DAYS,
  JOB_REQUEST_STATUS_ORDER,
  jobRequestAgeInDays,
  OPEN_JOB_REQUEST_STATUSES,
} from "@/lib/job-requests/constants";
import { formatDateBR } from "@/lib/job-requests/mapping";
import {
  displayStatusLabel,
  isConcludedRequest,
  requestDisplayStatus,
  type JobRequestDisplayStatus,
} from "@/lib/job-requests/outcome";
import { normalizeText } from "@/lib/utils";
import type { JobRequestStatus } from "@/types/domain";
import {
  EMPTY_JOB_REQUEST_FILTERS,
  type JobRequestFilters,
  type JobRequestRow,
} from "@/types/job-requests";

interface Props {
  requests: JobRequestRow[];
  /** Filtro rápido inicial vindo da URL (?status=) — links do Dashboard. */
  initialStatus?: string;
}

type QuickFilter = "OPEN" | "ALL" | "CONCLUDED" | JobRequestDisplayStatus;

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: "OPEN", label: "Aguardando ação" },
  { value: "PENDING_HR", label: "Aguardando RH" },
  { value: "PENDING_APPROVAL", label: "Aguardando aprovação" },
  { value: "RETURNED", label: "Devolvidas" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "RECRUITING", label: "Em recrutamento" },
  { value: "CONCLUDED", label: "Concluídas" },
  { value: "ALL", label: "Todas" },
];

/** Status do filtro "Status": os do workflow + os desfechos derivados da vaga. */
const STATUS_FILTER_OPTIONS: JobRequestDisplayStatus[] = [
  ...JOB_REQUEST_STATUS_ORDER,
  "FULFILLED",
  "CLOSED_UNFILLED",
];

const EMPTY_MESSAGES: Partial<Record<QuickFilter, string>> = {
  OPEN: "Nenhuma solicitação aguardando ação do RH ou do aprovador.",
  RECRUITING: "Nenhuma solicitação com processo seletivo em andamento.",
  CONCLUDED: "Nenhuma solicitação concluída.",
};

const selectClass =
  "w-full bg-white border border-[#E7EEDD] rounded-lg px-2.5 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-wg-green/40";

function uniqueSorted(values: Array<string | null>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v?.trim())))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export function JobRequestsExplorer({ requests, initialStatus }: Props) {
  const initialQuick: QuickFilter =
    initialStatus === "ALL" ||
    initialStatus === "CONCLUDED" ||
    (STATUS_FILTER_OPTIONS as string[]).includes(initialStatus ?? "")
      ? (initialStatus as QuickFilter)
      : "OPEN";
  const [quick, setQuick] = useState<QuickFilter>(initialQuick);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<JobRequestFilters>(EMPTY_JOB_REQUEST_FILTERS);

  const options = useMemo(
    () => ({
      requesters: uniqueSorted(requests.map((r) => r.requesterName)),
      locations: uniqueSorted(requests.map((r) => r.location)),
      departments: uniqueSorted(requests.map((r) => r.department)),
    }),
    [requests]
  );

  // Estado exibido: "Em recrutamento" vira Atendida/Encerrada conforme a vaga ligada (outcome.ts).
  const rows = useMemo(
    () => requests.map((r) => ({ ...r, display: requestDisplayStatus(r.status, r.jobStatus) })),
    [requests]
  );

  const visible = useMemo(() => {
    const q = normalizeText(query);
    return rows.filter((r) => {
      if (quick === "OPEN" && !OPEN_JOB_REQUEST_STATUSES.includes(r.status)) return false;
      if (quick === "CONCLUDED" && !isConcludedRequest(r.display)) return false;
      if (quick !== "OPEN" && quick !== "ALL" && quick !== "CONCLUDED" && r.display !== quick) return false;

      if (filters.status && r.display !== filters.status) return false;
      if (filters.requester && r.requesterName !== filters.requester) return false;
      if (filters.location && r.location !== filters.location) return false;
      if (filters.department && r.department !== filters.department) return false;
      if (filters.reason && r.reasonType !== filters.reason) return false;
      if (filters.from && r.createdAt.slice(0, 10) < filters.from) return false;
      if (filters.to && r.createdAt.slice(0, 10) > filters.to) return false;

      if (!q) return true;
      return [r.code, r.title, r.requesterName, r.location, r.department]
        .filter(Boolean)
        .some((v) => normalizeText(String(v)).includes(q));
    });
  }, [rows, quick, query, filters]);

  const counts = useMemo(() => {
    const open = requests.filter((r) => OPEN_JOB_REQUEST_STATUSES.includes(r.status));
    return {
      pendingHr: requests.filter((r) => r.status === "PENDING_HR").length,
      pendingApproval: requests.filter((r) => r.status === "PENDING_APPROVAL").length,
      approved: requests.filter((r) => r.status === "APPROVED").length,
      recruiting: rows.filter((r) => r.display === "RECRUITING").length,
      late: open.filter((r) => jobRequestAgeInDays(r.createdAt) > JOB_REQUEST_SLA_DAYS).length,
    };
  }, [requests, rows]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const kpis: Array<{ icon: LucideIcon; bg: string; fg: string; value: number; label: string }> = [
    { icon: Inbox, bg: "#E9EDFA", fg: "#3C56A8", value: counts.pendingHr, label: "Aguardando o RH" },
    { icon: Hourglass, bg: "#FCF1DD", fg: "#8A5B10", value: counts.pendingApproval, label: "Aguardando aprovação" },
    { icon: CheckCircle2, bg: "#EAF4DC", fg: "#4F6930", value: counts.approved, label: "Aprovadas sem vaga" },
    { icon: Target, bg: "#E2F0E4", fg: "#2F6B4F", value: counts.recruiting, label: "Em recrutamento" },
    {
      icon: Clock,
      bg: "#FDECEC",
      fg: "#A24B2B",
      value: counts.late,
      label: `Fora do SLA (${JOB_REQUEST_SLA_DAYS} dias)`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Resumo da fila */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-[#E7EEDD] rounded-2xl p-4">
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-2.5"
              style={{ background: k.bg, color: k.fg }}
            >
              <k.icon className="w-4 h-4" aria-hidden />
            </div>
            <div className="text-[#1A2213] text-2xl font-extrabold">{k.value}</div>
            <div className="text-[#55614A] text-[12.5px] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros rápidos + busca */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setQuick(f.value)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                quick === f.value
                  ? "bg-[#1A2213] text-white"
                  : "bg-white border border-[#E7EEDD] text-[#55614A] hover:bg-[#F4F7EE]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 md:ml-auto">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
              showFilters || activeFilterCount > 0
                ? "bg-[#1A2213] text-white"
                : "bg-white border border-[#E7EEDD] text-[#55614A] hover:bg-[#F4F7EE]"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 text-[11px]">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, cargo, gestor, unidade…"
              className="w-full bg-white border border-[#E7EEDD] rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40"
            />
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-[#E7EEDD] rounded-2xl p-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <label className="text-[12px] font-semibold text-[#55614A]">
            Status
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className={`${selectClass} mt-1`}
            >
              <option value="">Todos</option>
              {STATUS_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {displayStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[12px] font-semibold text-[#55614A]">
            Gestor
            <select
              value={filters.requester}
              onChange={(e) => setFilters((f) => ({ ...f, requester: e.target.value }))}
              className={`${selectClass} mt-1`}
            >
              <option value="">Todos</option>
              {options.requesters.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[12px] font-semibold text-[#55614A]">
            Unidade
            <select
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
              className={`${selectClass} mt-1`}
            >
              <option value="">Todas</option>
              {options.locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[12px] font-semibold text-[#55614A]">
            Área
            <select
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
              className={`${selectClass} mt-1`}
            >
              <option value="">Todas</option>
              {options.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[12px] font-semibold text-[#55614A]">
            Motivo
            <select
              value={filters.reason}
              onChange={(e) => setFilters((f) => ({ ...f, reason: e.target.value }))}
              className={`${selectClass} mt-1`}
            >
              <option value="">Todos</option>
              {Object.entries(JOB_REQUEST_REASON_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="text-[12px] font-semibold text-[#55614A]">
            Período da solicitação
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                className={selectClass}
              />
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                className={selectClass}
              />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_JOB_REQUEST_FILTERS)}
              className="md:col-span-3 lg:col-span-6 inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-[#9A3B3B] hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Tabela */}
      {visible.length === 0 ? (
        <div className="bg-white border border-[#E7EEDD] rounded-2xl p-10 text-center">
          <p className="text-[#1A2213] font-semibold">
            {(!query && activeFilterCount === 0 && EMPTY_MESSAGES[quick]) || "Nenhuma solicitação encontrada."}
          </p>
          <p className="text-[#55614A] text-sm mt-1">
            Os pedidos que os gestores enviam pelo formulário de solicitação aparecem aqui.
          </p>
          {quick !== "ALL" && requests.length > 0 && (
            <button
              type="button"
              onClick={() => setQuick("ALL")}
              className="mt-3 text-[13px] font-semibold text-[#4F6930] hover:underline"
            >
              Ver todas as {requests.length} solicitações
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E7EEDD] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAFCF6] text-left text-[11px] font-bold uppercase tracking-wide text-[#8A9480]">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Área</th>
                  <th className="px-4 py-3 hidden md:table-cell">Unidade</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Gestor</th>
                  <th className="px-4 py-3 hidden xl:table-cell">Motivo</th>
                  <th className="px-4 py-3 text-center" title="Número de posições">Posições</th>
                  <th className="px-4 py-3 hidden xl:table-cell">Data desejada</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Aprovador</th>
                  <th className="px-4 py-3 hidden md:table-cell">Solicitada em</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EEDD]">
                {visible.map((r) => {
                  const age = jobRequestAgeInDays(r.createdAt);
                  const late =
                    OPEN_JOB_REQUEST_STATUSES.includes(r.status) && age > JOB_REQUEST_SLA_DAYS;
                  return (
                    <tr key={r.id} className="hover:bg-[#FAFCF6] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/solicitacoes/${r.id}`}
                          className="font-bold text-[#4F6930] hover:underline"
                        >
                          {r.code ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1A2213] min-w-[180px]">
                        <Link href={`/solicitacoes/${r.id}`} className="hover:underline">
                          {r.title ?? "Sem título"}
                        </Link>
                        {late && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#A24B2B]">
                            <Clock className="w-3 h-3" />
                            {age}d
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#55614A] hidden lg:table-cell">
                        {r.department ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[#55614A] hidden md:table-cell">
                        {r.location ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[#55614A] hidden lg:table-cell">
                        {r.requesterName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[#55614A] hidden xl:table-cell">
                        {JOB_REQUEST_REASON_LABELS[r.reasonType]}
                      </td>
                      <td className="px-4 py-3 text-center text-[#1A2213] font-semibold">
                        {r.openings ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[#55614A] hidden xl:table-cell whitespace-nowrap">
                        {formatDateBR(r.desiredStartDate)}
                      </td>
                      <td className="px-4 py-3">
                        <JobRequestStatusBadge status={r.status} jobStatus={r.jobStatus} />
                      </td>
                      <td className="px-4 py-3 text-[#55614A] hidden lg:table-cell">
                        {r.status === "PENDING_APPROVAL"
                          ? (r.currentApproverName ?? "—")
                          : (r.approvedByName ?? "—")}
                      </td>
                      <td className="px-4 py-3 text-[#55614A] hidden md:table-cell whitespace-nowrap">
                        {formatDateBR(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/solicitacoes/${r.id}`}
                          aria-label={`Abrir solicitação ${r.code ?? ""}`}
                          className="inline-flex items-center text-[#8A9480] hover:text-[#4F6930]"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#E7EEDD] px-4 py-2.5 text-[12.5px] text-[#55614A]">
            <span>
              {visible.length} de {requests.length} solicitações
            </span>
            <a
              href="/solicitar-vaga"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-[#4F6930] hover:underline"
            >
              <FileDown className="w-3.5 h-3.5" />
              Ver formulário do gestor
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
