"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Star, Briefcase, FlaskConical, MessageSquare, History } from "lucide-react";
import type { TalentoProfile, TalentoStatus, TalentoTag } from "@/lib/talentos/types";
import TalentoTestsTab from "./TalentoTestsTab";
import TalentoNotesTab from "./TalentoNotesTab";
import TalentoHistoryTab from "./TalentoHistoryTab";

const STATUS_LABELS: Record<TalentoStatus, string> = {
  ATIVO:        "Ativo",
  EM_PROCESSO:  "Em processo",
  CONTRATADO:   "Contratado",
  NAO_ADERENTE: "Não aderente",
  ARQUIVADO:    "Arquivado",
};
const STATUS_COLORS: Record<TalentoStatus, string> = {
  ATIVO:        "bg-green-100 text-green-800",
  EM_PROCESSO:  "bg-blue-100 text-blue-800",
  CONTRATADO:   "bg-wg-green/20 text-wg-green-dark",
  NAO_ADERENTE: "bg-orange-100 text-orange-800",
  ARQUIVADO:    "bg-gray-100 text-gray-500",
};

type Tab = "dados" | "testes" | "candidaturas" | "notas";

interface Props {
  talento:       TalentoProfile;
  availableTags: TalentoTag[];
  isAdmin:       boolean;
}

export default function TalentoProfilePage({ talento, availableTags, isAdmin }: Props) {
  const [tab, setTab] = useState<Tab>("dados");

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "dados",         label: "Dados",        icon: Star },
    { id: "testes",        label: "Testes",       icon: FlaskConical,  count: talento.testes.length },
    { id: "candidaturas",  label: "Candidaturas", icon: Briefcase,     count: talento.candidaturas.length },
    { id: "notas",         label: "Notas",        icon: MessageSquare, count: talento.notas.length },
  ];

  return (
    <div>
      {/* Back + header */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Link href="/talentos" className="flex items-center gap-1 text-sm text-wg-ink-muted hover:text-wg-ink transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Talentos
        </Link>
        <h1 className="text-xl font-bold text-wg-ink">{talento.nomeCompleto}</h1>
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[talento.statusBanco]}`}>
          {STATUS_LABELS[talento.statusBanco]}
        </span>
      </div>

      {/* Tags */}
      {talento.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {talento.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: `${tag.cor}22`, color: tag.cor }}
            >
              {tag.nome}
            </span>
          ))}
        </div>
      )}

      {/* Abas */}
      <div className="mb-5 flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-wg-green text-wg-green-dark"
                : "border-transparent text-wg-ink-secondary hover:text-wg-ink"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`inline-flex items-center justify-center px-1.5 py-px rounded-full text-[10px] font-bold min-w-[18px] ${
                tab === t.id ? "bg-wg-green/20 text-wg-green-dark" : "bg-gray-100 text-gray-500"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo de aba */}
      {tab === "dados"        && <DadosTab talento={talento} availableTags={availableTags} isAdmin={isAdmin} />}
      {tab === "testes"       && <TalentoTestsTab testes={talento.testes} talentoId={talento.id} isAdmin={isAdmin} />}
      {tab === "candidaturas" && <TalentoHistoryTab candidaturas={talento.candidaturas} />}
      {tab === "notas"        && <TalentoNotesTab notas={talento.notas} talentoId={talento.id} isAdmin={isAdmin} />}
    </div>
  );
}

function DadosTab({ talento, availableTags, isAdmin }: { talento: TalentoProfile; availableTags: TalentoTag[]; isAdmin: boolean }) {
  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "E-mail",              value: talento.email },
    { label: "CPF",                 value: talento.cpf },
    { label: "Telefone",            value: talento.telefone },
    { label: "Cidade",              value: talento.cidade },
    { label: "Estado",              value: talento.estado },
    { label: "Cargo desejado",      value: talento.cargoDesejado },
    { label: "Pretensão salarial",  value: talento.pretensaoSalarial != null
        ? `R$ ${talento.pretensaoSalarial.toLocaleString("pt-BR")}` : null },
    { label: "LinkedIn",            value: talento.linkedinUrl },
    { label: "Origem",              value: talento.origem },
    { label: "LGPD consentido em",  value: talento.consentimentoLgpdEm
        ? new Date(talento.consentimentoLgpdEm).toLocaleDateString("pt-BR") : null },
    { label: "Validade LGPD",       value: talento.consentimentoValidadeAte
        ? new Date(talento.consentimentoValidadeAte).toLocaleDateString("pt-BR") : null },
    { label: "No banco desde",      value: new Date(talento.createdAt).toLocaleDateString("pt-BR") },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-wg-ink-muted mb-1">{label}</div>
            <div className="text-sm font-medium text-wg-ink">
              {value ?? <span className="italic text-wg-ink-muted">—</span>}
            </div>
          </div>
        ))}
      </div>

      {talento.curriculoUrl && (
        <a
          href={talento.curriculoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-wg-border bg-white text-sm font-medium text-wg-ink hover:bg-gray-50 shadow-sm transition-colors"
        >
          <History className="w-4 h-4" />
          Baixar currículo {talento.curriculoNome ? `— ${talento.curriculoNome}` : ""}
        </a>
      )}

      {talento.resumoProfissional && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-wg-ink-muted mb-2">Resumo profissional</div>
          <p className="text-sm text-wg-ink-secondary whitespace-pre-wrap leading-relaxed">{talento.resumoProfissional}</p>
        </div>
      )}

      {isAdmin && availableTags.length > 0 && (
        <TagEditor talentoId={talento.id} currentTags={talento.tags} availableTags={availableTags} />
      )}
    </div>
  );
}

function TagEditor({ talentoId, currentTags, availableTags }: {
  talentoId: string; currentTags: TalentoTag[]; availableTags: TalentoTag[];
}) {
  const [selected, setSelected] = useState<string[]>(currentTags.map((t) => t.id));
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/talentos/${talentoId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: selected }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-wg-ink-muted mb-3">Editar tags</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {availableTags.map((tag) => {
          const active = selected.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => toggle(tag.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                active ? "border-transparent" : "border-gray-200 bg-white text-gray-500"
              }`}
              style={active ? { backgroundColor: `${tag.cor}22`, color: tag.cor, borderColor: `${tag.cor}55` } : {}}
            >
              {tag.nome}
            </button>
          );
        })}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-1.5 text-sm font-medium rounded-lg bg-wg-green text-white hover:bg-wg-green-dark disabled:opacity-60 transition-colors"
      >
        {saved ? "Salvo!" : saving ? "Salvando…" : "Salvar tags"}
      </button>
    </div>
  );
}
