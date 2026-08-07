"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Search, ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { TalentoListItem, TalentoTag, TalentoStatus } from "@/lib/talentos/types";

const STATUS_LABELS: Record<TalentoStatus, string> = {
  ATIVO:           "Ativo",
  EM_PROCESSO:     "Em processo",
  CONTRATADO:      "Contratado",
  NAO_ADERENTE:    "Não aderente",
  ARQUIVADO:       "Arquivado",
};

const STATUS_COLORS: Record<TalentoStatus, string> = {
  ATIVO:           "bg-green-100 text-green-800",
  EM_PROCESSO:     "bg-blue-100 text-blue-800",
  CONTRATADO:      "bg-wg-green/20 text-wg-green-dark",
  NAO_ADERENTE:    "bg-orange-100 text-orange-800",
  ARQUIVADO:       "bg-gray-100 text-gray-500",
};

interface Props {
  talentos:      TalentoListItem[];
  total:         number;
  page:          number;
  pageSize:      number;
  isAdmin:       boolean;
  availableTags: TalentoTag[];
  initialQ:      string;
  initialStatus: string;
  initialEstado: string;
}

export default function TalentosList({
  talentos, total, page, pageSize, initialQ, initialStatus, initialEstado,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  const [q, setQ]           = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [estado, setEstado] = useState(initialEstado);

  const debouncedQ = useDebouncedValue(q, 400);

  const pushParams = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(sp.toString());
      Object.entries(overrides).forEach(([k, v]) => {
        if (v) params.set(k, v); else params.delete(k);
      });
      params.delete("page"); // reset pagination on filter change
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  // Sync debounced search to URL
  const prevQ = sp.get("q") ?? "";
  if (debouncedQ !== prevQ) {
    pushParams({ q: debouncedQ });
  }

  const totalPages = Math.ceil(total / pageSize);

  function setPage(p: number) {
    const params = new URLSearchParams(sp.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  const ESTADOS_BR = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
    "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
  ];

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-wg-ink flex items-center gap-2">
          <Star className="w-5 h-5 text-wg-green" />
          Banco de Talentos
        </h1>
        <span className="text-sm text-wg-ink-muted">
          {total.toLocaleString("pt-BR")} talento{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wg-ink-muted" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou cargo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-wg-border bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-wg-green/40"
          />
        </div>

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); pushParams({ status: e.target.value }); }}
          className="px-3 py-2 text-sm rounded-lg border border-wg-border bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-wg-green/40"
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABELS) as TalentoStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={estado}
          onChange={(e) => { setEstado(e.target.value); pushParams({ estado: e.target.value }); }}
          className="px-3 py-2 text-sm rounded-lg border border-wg-border bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-wg-green/40"
        >
          <option value="">Todos os estados</option>
          {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {talentos.length === 0 ? (
          <div className="py-16 text-center text-wg-ink-muted text-sm">
            Nenhum talento encontrado com os filtros aplicados.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-wg-ink-muted">Nome</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-wg-ink-muted hidden md:table-cell">Cargo desejado</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-wg-ink-muted hidden lg:table-cell">Localização</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-wg-ink-muted">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-wg-ink-muted hidden xl:table-cell">Tags</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-wg-ink-muted hidden lg:table-cell">Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {talentos.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i === talentos.length - 1 ? "border-b-0" : ""}`}
                >
                  <td className="px-5 py-3.5">
                    <Link href={`/talentos/${t.id}`} className="group">
                      <div className="font-semibold text-wg-ink group-hover:text-wg-green transition-colors">
                        {t.nomeCompleto}
                      </div>
                      <div className="text-[12px] text-wg-ink-muted">{t.email}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-wg-ink-secondary hidden md:table-cell">
                    {t.cargoDesejado ?? <span className="text-wg-ink-muted italic">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-wg-ink-secondary hidden lg:table-cell">
                    {t.cidade && t.estado
                      ? `${t.cidade} / ${t.estado}`
                      : (t.estado ?? <span className="text-wg-ink-muted italic">—</span>)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[t.statusBanco]}`}>
                      {STATUS_LABELS[t.statusBanco]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {t.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: `${tag.cor}22`, color: tag.cor }}
                        >
                          {tag.nome}
                        </span>
                      ))}
                      {t.tags.length > 3 && (
                        <span className="text-[11px] text-wg-ink-muted">+{t.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-wg-ink-muted hidden lg:table-cell">
                    {new Date(t.ultimaAtividadeEm).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-wg-ink-muted">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-wg-border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-wg-border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
