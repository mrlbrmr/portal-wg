"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ClipboardCheck, Filter } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export interface AdmissionRow {
  id: string;
  fullName: string;
  cpf: string | null;
  positionName: string | null;
  companyName: string | null;
  branchName: string | null;
  stageId: string | null;
  stageName: string | null;
  stageColor: string | null;
  responsibleName: string | null;
  startDate: string | null;
}

interface Option {
  id: string;
  name: string;
}

interface Props {
  rows: AdmissionRow[];
  stages: Option[];
  companies: Option[];
  positions: Option[];
}

const selectClass =
  "bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green";

function StageBadge({ name, color }: { name: string | null; color: string | null }) {
  if (!name) return <span className="text-gray-400">—</span>;
  const c = color ?? "#94a3b8";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${c}1f`, color: c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
      {name}
    </span>
  );
}

export function AdmissionsExplorer({ rows, stages, companies, positions }: Props) {
  const [query, setQuery] = useState("");
  const [stageId, setStageId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [positionId, setPositionId] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (stageId && r.stageId !== stageId) return false;
      if (companyId && r.companyName !== companies.find((c) => c.id === companyId)?.name) return false;
      if (positionId && r.positionName !== positions.find((p) => p.id === positionId)?.name) return false;
      if (q) {
        const hay = `${r.fullName} ${r.cpf ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, stageId, companyId, positionId, companies, positions]);

  const hasFilters = !!(query || stageId || companyId || positionId);

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhuma admissão ainda"
          description="Cadastre a primeira admissão para começar a acompanhar o onboarding."
          action={
            <Link
              href="/admissoes/nova"
              className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-semibold px-4 py-2 rounded-full text-sm transition-colors"
            >
              Nova admissão
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou CPF…"
            className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green"
          />
        </div>
        <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={selectClass}>
          <option value="">Todas as etapas</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={selectClass}>
          <option value="">Todas as empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={selectClass}>
          <option value="">Todos os cargos</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="Nenhum resultado"
            description="Nenhuma admissão corresponde aos filtros aplicados."
            action={
              hasFilters ? (
                <button
                  onClick={() => {
                    setQuery("");
                    setStageId("");
                    setCompanyId("");
                    setPositionId("");
                  }}
                  className="text-sm font-medium text-wg-green-dark hover:underline"
                >
                  Limpar filtros
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Empresa / Filial</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Início</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admissoes/${r.id}`} className="font-medium text-gray-900 hover:text-wg-green-dark">
                        {r.fullName}
                      </Link>
                      {r.cpf && <div className="text-xs text-gray-400">{r.cpf}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.positionName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.companyName ?? "—"}
                      {r.branchName && <span className="text-gray-400"> · {r.branchName}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge name={r.stageName} color={r.stageColor} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.responsibleName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.startDate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        {filtered.length} de {rows.length} admiss{rows.length === 1 ? "ão" : "ões"}
      </p>
    </div>
  );
}
