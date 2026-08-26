"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  Search, ChevronLeft, ChevronRight, Star,
  MoreHorizontal, Eye, Download, Archive,
} from "lucide-react";
import type { TalentoListItem, TalentoTag, TalentoStatus } from "@/lib/talentos/types";
import { STATUS_LABELS, STATUS_COLORS, getInitials, getAvatarStyle } from "./talentos-utils";
import { TalentoPerfilModal } from "./TalentoPerfilModal";

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

  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId]     = useState<string | null>(null);
  const [perfilAberto, setPerfilAberto] = useState<TalentoListItem | null>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const debouncedQ = useDebouncedValue(q, 400);

  const pushParams = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(sp.toString());
      Object.entries(overrides).forEach(([k, v]) => {
        if (v) params.set(k, v); else params.delete(k);
      });
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  const prevQ = sp.get("q") ?? "";
  if (debouncedQ !== prevQ) pushParams({ q: debouncedQ });

  // Fecha o dropdown ao clicar fora do seu container
  useEffect(() => {
    if (!openMenuId) return;
    function handler(e: MouseEvent) {
      const el = menuRefs.current.get(openMenuId!);
      if (el && !el.contains(e.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  const totalPages   = Math.ceil(total / pageSize);
  const pageIds      = talentos.map((t) => t.id);
  const allSelected  = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = pageIds.some((id) => selectedIds.has(id)) && !allSelected;

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else             pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {talentos.length === 0 ? (
          <div className="py-16 text-center text-wg-ink-muted text-sm">
            Nenhum talento encontrado com os filtros aplicados.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                {/* Checkbox — selecionar todos / indeterminate */}
                <th className="w-10 pl-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-wg-green focus:ring-2 focus:ring-wg-green/40"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Cargo desejado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Localização</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden xl:table-cell">Tags</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Última atividade</th>
                {/* Coluna de ações — sem título */}
                <th className="w-12 py-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              {talentos.map((t, i) => {
                const isSelected  = selectedIds.has(t.id);
                const avatarStyle = getAvatarStyle(t.nomeCompleto);
                const isLast      = i === talentos.length - 1;

                return (
                  <tr
                    key={t.id}
                    onClick={() => setPerfilAberto(t)}
                    className={[
                      "border-b border-slate-100 transition-colors cursor-pointer",
                      isLast ? "border-b-0" : "",
                      isSelected ? "bg-[#F3F9E9]" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {/* Checkbox individual — stripe WG-green quando selecionado */}
                    <td
                      className={[
                        "py-3",
                        isSelected
                          ? "pl-[13px] border-l-[3px] border-wg-green"
                          : "pl-4",
                      ].join(" ")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(t.id)}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-wg-green focus:ring-2 focus:ring-wg-green/40"
                      />
                    </td>

                    {/* Nome + avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none"
                          style={{ background: avatarStyle.bg, color: avatarStyle.fg }}
                        >
                          {getInitials(t.nomeCompleto)}
                        </div>
                        <Link
                          href={`/talentos/${t.id}`}
                          className="group"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="font-semibold text-wg-ink group-hover:text-wg-green transition-colors">
                            {t.nomeCompleto}
                          </div>
                          <div className="text-[12px] text-wg-ink-muted">{t.email}</div>
                        </Link>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-wg-ink-secondary hidden md:table-cell">
                      {t.cargoDesejado ?? <span className="text-gray-300 font-light">—</span>}
                    </td>

                    <td className="px-4 py-3 text-wg-ink-secondary hidden lg:table-cell">
                      {t.cidade && t.estado
                        ? `${t.cidade} / ${t.estado}`
                        : t.estado ?? <span className="text-gray-300 font-light">—</span>}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[t.statusBanco]}`}>
                        {STATUS_LABELS[t.statusBanco]}
                      </span>
                    </td>

                    <td className="px-4 py-3 hidden xl:table-cell">
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

                    <td className="px-4 py-3 text-[12px] text-wg-ink-muted hidden lg:table-cell">
                      {new Date(t.ultimaAtividadeEm).toLocaleDateString("pt-BR")}
                    </td>

                    {/* Menu de ações */}
                    <td
                      className="pr-3 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className="relative inline-block"
                        ref={(el) => { if (el) menuRefs.current.set(t.id, el as HTMLDivElement); }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === t.id ? null : t.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-wg-ink hover:bg-gray-100 transition-colors"
                          aria-label="Ações"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {openMenuId === t.id && (
                          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[152px]">
                            <button
                              type="button"
                              onClick={() => { setOpenMenuId(null); setPerfilAberto(t); }}
                              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-wg-ink hover:bg-gray-50 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-wg-ink-muted shrink-0" />
                              Ver Perfil
                            </button>
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(null)}
                              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-wg-ink hover:bg-gray-50 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-wg-ink-muted shrink-0" />
                              Baixar CV
                            </button>
                            <div className="h-px bg-gray-100 mx-2" />
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(null)}
                              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Archive className="w-3.5 h-3.5 shrink-0" />
                              Arquivar
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de perfil */}
      {perfilAberto && (
        <TalentoPerfilModal
          talento={perfilAberto}
          onClose={() => setPerfilAberto(null)}
        />
      )}

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
