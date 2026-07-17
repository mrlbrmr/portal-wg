"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ClipboardCheck, Filter, ChevronDown, ArrowUpDown } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export interface AdmissionRow {
  id: string;
  fullName: string;
  cpf: string | null;
  positionName: string | null;
  companyId: string | null;
  companyName: string | null;
  branchName: string | null;
  stageId: string | null;
  stageName: string | null;
  stageColor: string | null;
  responsibleName: string | null;
  startDate: string | null;     // "DD/MM/YYYY" para exibição
  startDateISO: string | null;  // "YYYY-MM-DD" para filtro/ordenação
  createdAt: string;            // ISO para ordenação
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

type SortKey = "recent" | "oldest" | "nameAZ" | "nameZA" | "startAsc" | "startDesc" | "stage";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigas",
  nameAZ: "Nome A→Z",
  nameZA: "Nome Z→A",
  startAsc: "Início ↑",
  startDesc: "Início ↓",
  stage: "Por etapa",
};

const ctrlClass =
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

/** Dropdown com checkboxes para seleção múltipla. */
function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: Option[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  const label =
    selected.size === 0
      ? placeholder
      : selected.size === 1
      ? (options.find((o) => selected.has(o.id))?.name ?? placeholder)
      : `${selected.size} selecionados`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${ctrlClass} inline-flex items-center gap-2 hover:border-gray-400 transition-colors`}
      >
        <span className={selected.size > 0 ? "text-gray-900 font-medium" : "text-gray-500"}>
          {label}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 min-w-[180px] max-h-60 overflow-y-auto">
            {options.map((o) => (
              <label
                key={o.id}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm select-none"
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(o.id);
                    else next.delete(o.id);
                    onChange(next);
                  }}
                  className="accent-wg-green w-4 h-4 shrink-0"
                />
                <span>{o.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AdmissionsExplorer({ rows, stages, companies, positions }: Props) {
  const [query, setQuery] = useState("");
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [positionId, setPositionId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [startFrom, setStartFrom] = useState("");
  const [startTo, setStartTo] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const result = rows.filter((r) => {
      if (selectedStages.size > 0 && !selectedStages.has(r.stageId ?? "")) return false;
      if (selectedCompanies.size > 0 && !selectedCompanies.has(r.companyId ?? "")) return false;
      if (positionId && r.positionName !== positions.find((p) => p.id === positionId)?.name) return false;
      if (startFrom && (!r.startDateISO || r.startDateISO < startFrom)) return false;
      if (startTo && (!r.startDateISO || r.startDateISO > startTo)) return false;
      if (q) {
        const hay = `${r.fullName} ${r.cpf ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return result.sort((a, b) => {
      switch (sortKey) {
        case "recent":    return b.createdAt.localeCompare(a.createdAt);
        case "oldest":    return a.createdAt.localeCompare(b.createdAt);
        case "nameAZ":    return a.fullName.localeCompare(b.fullName, "pt-BR");
        case "nameZA":    return b.fullName.localeCompare(a.fullName, "pt-BR");
        case "startAsc":  return (a.startDateISO ?? "").localeCompare(b.startDateISO ?? "");
        case "startDesc": return (b.startDateISO ?? "").localeCompare(a.startDateISO ?? "");
        case "stage":     return (a.stageName ?? "").localeCompare(b.stageName ?? "", "pt-BR");
        default:          return 0;
      }
    });
  }, [rows, query, selectedStages, selectedCompanies, positionId, sortKey, startFrom, startTo, positions]);

  const hasFilters = !!(
    query ||
    selectedStages.size ||
    selectedCompanies.size ||
    positionId ||
    startFrom ||
    startTo
  );

  function clearFilters() {
    setQuery("");
    setSelectedStages(new Set());
    setSelectedCompanies(new Set());
    setPositionId("");
    setStartFrom("");
    setStartTo("");
  }

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
    <div className="space-y-3">
      {/* Linha 1: busca + filtros */}
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

        <MultiSelect
          options={stages}
          selected={selectedStages}
          onChange={setSelectedStages}
          placeholder="Todas as etapas"
        />

        <MultiSelect
          options={companies}
          selected={selectedCompanies}
          onChange={setSelectedCompanies}
          placeholder="Todas as empresas"
        />

        <select
          value={positionId}
          onChange={(e) => setPositionId(e.target.value)}
          className={ctrlClass}
        >
          <option value="">Todos os cargos</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Linha 2: data de início + ordenação */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="shrink-0">Início:</span>
          <input
            type="date"
            value={startFrom}
            onChange={(e) => setStartFrom(e.target.value)}
            className={`${ctrlClass} text-gray-700 w-[150px]`}
          />
          <span className="shrink-0">até</span>
          <input
            type="date"
            value={startTo}
            onChange={(e) => setStartTo(e.target.value)}
            className={`${ctrlClass} text-gray-700 w-[150px]`}
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className={ctrlClass}
          >
            {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm font-medium text-wg-green-dark hover:underline"
          >
            Limpar filtros
          </button>
        )}
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
                  onClick={clearFilters}
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
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admissoes/${r.id}`}
                        className="font-medium text-gray-900 hover:text-wg-green-dark"
                      >
                        {r.fullName}
                      </Link>
                      {r.cpf && <div className="text-xs text-gray-400">{r.cpf}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.positionName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.companyName ?? "—"}
                      {r.branchName && (
                        <span className="text-gray-400"> · {r.branchName}</span>
                      )}
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
