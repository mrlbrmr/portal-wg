"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Search, Users, X, CheckCircle2, MapPin, Briefcase } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

interface TalentoItem {
  id: string;
  nomeCompleto: string;
  email: string;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  cargoDesejado: string | null;
  statusBanco: "ATIVO" | "EM_PROCESSO";
}

const STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  EM_PROCESSO: "Em processo",
};

const STATUS_COLORS: Record<string, string> = {
  ATIVO: "bg-emerald-100 text-emerald-700",
  EM_PROCESSO: "bg-amber-100 text-amber-700",
};

interface Props {
  jobId: string;
}

export function IncluirTalentoModal({ jobId }: Props) {
  const router = useRouter();
  const { notify } = useToast();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [talentos, setTalentos] = useState<TalentoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TalentoItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchTalentos(search), search ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, open]);

  async function fetchTalentos(q: string) {
    setLoading(true);
    try {
      const url = `/api/talentos?${q ? `search=${encodeURIComponent(q)}&` : ""}limit=30`;
      const res = await fetch(url, { credentials: "same-origin" });
      if (res.ok) setTalentos(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function close() {
    if (saving) return;
    setOpen(false);
    setSearch("");
    setSelected(null);
    setError(null);
    setTalentos([]);
  }

  async function handleIncluir() {
    if (!selected) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/vagas/${jobId}/candidatos/from-talento`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talentoId: selected.id }),
      });

      if (!res.ok) {
        let message = "Não foi possível incluir o candidato.";
        try {
          const j = await res.json();
          if (typeof j.error === "string") message = j.error;
        } catch { /* mantém padrão */ }
        setError(message);
        return;
      }

      notify("success", `${selected.nomeCompleto} incluído na vaga.`);
      close();
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE8CC] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A2213] transition-colors hover:bg-[#EEF4E3]"
      >
        <Users className="h-4 w-4 text-[#4F6930]" />
        Incluir candidato
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

          <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl" style={{ maxHeight: "85vh" }}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Incluir do banco de talentos</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Selecione um talento para encaixá-lo nessa vaga sem duplicar o cadastro.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="border-b border-gray-100 px-5 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelected(null); setError(null); }}
                  placeholder="Buscar por nome ou e-mail…"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30 transition-colors"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando…
                </div>
              ) : talentos.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                  {search ? "Nenhum talento encontrado para essa busca." : "Nenhum talento ativo no banco."}
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {talentos.map((t) => {
                    const isSelected = selected?.id === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => { setSelected(isSelected ? null : t); setError(null); }}
                          className={`w-full px-5 py-3 text-left transition-colors hover:bg-gray-50 ${isSelected ? "bg-[#EEF4E3]" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isSelected ? "border-wg-green bg-wg-green" : "border-gray-300"}`}>
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-black" strokeWidth={2.5} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">{t.nomeCompleto}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[t.statusBanco]}`}>
                                  {STATUS_LABELS[t.statusBanco]}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-gray-500">{t.email}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-3">
                                {(t.cidade || t.estado) && (
                                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                    <MapPin className="h-3 w-3" />
                                    {[t.cidade, t.estado].filter(Boolean).join("/")}
                                  </span>
                                )}
                                {t.cargoDesejado && (
                                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                    <Briefcase className="h-3 w-3" />
                                    {t.cargoDesejado}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 p-5">
              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
              {selected && (
                <p className="mb-3 text-xs text-gray-500">
                  Selecionado: <span className="font-semibold text-gray-800">{selected.nomeCompleto}</span>
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={saving}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleIncluir}
                  disabled={!selected || saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-wg-green px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-wg-green-bright disabled:opacity-40"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  Incluir na vaga
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
