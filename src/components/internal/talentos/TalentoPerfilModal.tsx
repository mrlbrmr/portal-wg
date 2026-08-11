"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Download, Mail, Phone, MapPin, Calendar, Briefcase } from "lucide-react";
import type { TalentoListItem } from "@/lib/talentos/types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  getInitials,
  getAvatarStyle,
} from "./talentos-utils";

interface Props {
  talento: TalentoListItem;
  onClose: () => void;
}

export function TalentoPerfilModal({ talento, onClose }: Props) {
  // Fecha ao pressionar Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const avatarStyle = getAvatarStyle(talento.nomeCompleto);
  const localizacao = [talento.cidade, talento.estado].filter(Boolean).join(" / ") || null;

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Card */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Perfil de ${talento.nomeCompleto}`}
      >
        {/* Botão fechar */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-gray-400
                     hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Cabeçalho ── */}
        <div className="px-6 pt-6 pb-5 border-b border-gray-100 flex items-center gap-4">
          {/* Avatar grande */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center
                       text-[18px] font-bold shrink-0 select-none"
            style={{ background: avatarStyle.bg, color: avatarStyle.fg }}
          >
            {getInitials(talento.nomeCompleto)}
          </div>

          <div className="min-w-0">
            <h2 className="text-wg-ink font-bold text-lg leading-snug truncate">
              {talento.nomeCompleto}
            </h2>
            {talento.cargoDesejado && (
              <p className="text-wg-ink-muted text-sm mt-0.5 truncate">
                {talento.cargoDesejado}
              </p>
            )}
            <span
              className={`inline-flex mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold
                          ${STATUS_COLORS[talento.statusBanco]}`}
            >
              {STATUS_LABELS[talento.statusBanco]}
            </span>
          </div>
        </div>

        {/* ── Corpo ── */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[55vh]">

          {/* Contato */}
          <section>
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-wg-ink-muted mb-3">
              Contato
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-sm text-wg-ink-secondary">
                <Mail className="w-4 h-4 text-wg-ink-muted shrink-0" />
                <span>{talento.email}</span>
              </div>
              {talento.telefone ? (
                <div className="flex items-center gap-2.5 text-sm text-wg-ink-secondary">
                  <Phone className="w-4 h-4 text-wg-ink-muted shrink-0" />
                  <span>{talento.telefone}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="w-4 h-4 text-gray-300 shrink-0" />
                  <span className="text-gray-300 font-light">Telefone não informado</span>
                </div>
              )}
            </div>
          </section>

          {/* Grid de detalhes — 2 colunas */}
          <section>
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-wg-ink-muted mb-3">
              Detalhes
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-[11px] text-wg-ink-muted mb-1">Cargo desejado</p>
                {talento.cargoDesejado ? (
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-wg-ink-muted shrink-0" />
                    <span className="text-sm font-medium text-wg-ink truncate">
                      {talento.cargoDesejado}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-300 font-light">—</span>
                )}
              </div>

              <div>
                <p className="text-[11px] text-wg-ink-muted mb-1">Localização</p>
                {localizacao ? (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-wg-ink-muted shrink-0" />
                    <span className="text-sm font-medium text-wg-ink">{localizacao}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-300 font-light">—</span>
                )}
              </div>

              <div>
                <p className="text-[11px] text-wg-ink-muted mb-1">Última atividade</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-wg-ink-muted shrink-0" />
                  <span className="text-sm font-medium text-wg-ink">
                    {new Date(talento.ultimaAtividadeEm).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-wg-ink-muted mb-1">No banco desde</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-wg-ink-muted shrink-0" />
                  <span className="text-sm font-medium text-wg-ink">
                    {new Date(talento.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Tags */}
          {talento.tags.length > 0 && (
            <section>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-wg-ink-muted mb-2.5">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {talento.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex px-2.5 py-1 rounded-lg text-[12px] font-medium"
                    style={{ backgroundColor: `${tag.cor}22`, color: tag.cor }}
                  >
                    {tag.nome}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── Rodapé ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 bg-wg-green hover:bg-wg-green-bright
                       text-black font-semibold text-sm rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar CV
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-wg-ink-secondary
                       hover:bg-gray-50 hover:border-gray-300 font-medium text-sm
                       rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );

  // Renderiza fora da árvore DOM da tabela para evitar conflitos de z-index / overflow
  return typeof window !== "undefined"
    ? createPortal(modal, document.body)
    : null;
}
