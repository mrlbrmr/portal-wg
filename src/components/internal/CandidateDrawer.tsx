"use client";

import { useEffect, useState } from "react";
import { X, Mail, Phone, Download, Clock, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDate, formatDateTime } from "@/lib/utils";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import { AssessmentsSection } from "@/components/internal/AssessmentsSection";

interface StageRef {
  name: string;
  color: string;
}

interface StageHistoryEntry {
  id: string;
  stage: StageRef | null;
  changedBy: string;
  changedAt: string;
}

interface CandidateDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  resumeName: string | null;
  stage: StageRef | null;
  source: string;
  addedBy: string | null;
  notes: string | null;
  createdAt: string;
  stageHistory: StageHistoryEntry[];
}

/** Badge de etapa com a cor configurável do funil (mesmo padrão das admissões). */
function stageStyle(color: string | undefined) {
  const c = color ?? "#94a3b8";
  return { backgroundColor: `${c}1f`, color: c };
}

interface Props {
  applicationId: string | null;
  canManage: boolean;
  onClose: () => void;
}

/**
 * Ficha do candidato em drawer lateral: dados de contato, currículo, etapa
 * atual, anotações internas do RH (editáveis, campo `notes` do schema) e a
 * timeline de mudanças de etapa (de `ApplicationStageHistory`). Busca sob
 * demanda em GET /api/applications/[id] ao abrir.
 */
export function CandidateDrawer({ applicationId, canManage, onClose }: Props) {
  const { notify } = useToast();
  const [data, setData] = useState<CandidateDetail | null>(null);
  const [error, setError] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!applicationId) return;
    let active = true;
    setData(null);
    setError(false);
    fetch(`/api/applications/${applicationId}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: CandidateDetail) => {
        if (active) {
          setData(d);
          setNotes(d.notes ?? "");
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [applicationId, onClose]);

  if (!applicationId) return null;

  async function saveNotes() {
    if (!applicationId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() ? notes : null }),
      });
      if (!res.ok) {
        notify("error", "Erro ao salvar as anotações.");
        return;
      }
      notify("success", "Anotações salvas.");
      setData((d) => (d ? { ...d, notes } : d));
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = data ? (data.notes ?? "") !== notes : false;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Ficha do candidato</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="text-sm text-red-600">Não foi possível carregar a ficha.</p>
          ) : !data ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="mt-4 h-28 w-full" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-gray-900">{data.fullName}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {data.source && data.source !== "PORTAL" ? "Cadastrado" : "Inscrito"} em{" "}
                    {formatDate(data.createdAt)}
                    {data.source && data.source !== "PORTAL" && (
                      <>
                        {" · via "}
                        <span className="font-medium text-gray-600">
                          {APPLICATION_SOURCE_LABELS[data.source] ?? data.source}
                        </span>
                        {data.addedBy ? ` (por ${data.addedBy})` : ""}
                      </>
                    )}
                  </p>
                </div>
                {data.stage && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={stageStyle(data.stage.color)}
                  >
                    {data.stage.name}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href={`mailto:${data.email}`}
                  className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-wg-green-dark"
                >
                  <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate">{data.email}</span>
                </a>
                <a
                  href={`tel:${data.phone.replace(/\D/g, "")}`}
                  className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-wg-green-dark"
                >
                  <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                  {data.phone}
                </a>
                {data.resumeName ? (
                  <a
                    href={`/api/applications/${data.id}/resume`}
                    className="flex items-center gap-2 text-sm font-medium text-wg-green-dark transition-opacity hover:opacity-80"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    Baixar currículo
                  </a>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-gray-400">
                    <Download className="h-4 w-4 shrink-0" />
                    Sem currículo
                  </span>
                )}
              </div>

              {/* Anotações internas */}
              <div className="mt-6">
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">
                  Anotações internas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canManage}
                  rows={5}
                  placeholder={
                    canManage
                      ? "Observações sobre o candidato (visível só para o RH)..."
                      : "Sem anotações."
                  }
                  className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/40 disabled:bg-gray-50 disabled:text-gray-500"
                />
                {canManage && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={saveNotes}
                      disabled={!dirty || saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-wg-green px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-wg-green-bright disabled:opacity-50"
                    >
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Salvar anotações
                    </button>
                  </div>
                )}
              </div>

              {/* Avaliações (entrevistas / testes / IA) */}
              <AssessmentsSection applicationId={data.id} canManage={canManage} />

              {/* Timeline de etapas */}
              <div className="mt-6">
                <div className="mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900">Histórico de etapas</h3>
                </div>
                {data.stageHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Sem movimentações registradas ainda.
                  </p>
                ) : (
                  <ol className="relative ml-1 border-l border-gray-200">
                    {data.stageHistory.map((h) => (
                      <li key={h.id} className="mb-4 ml-4 last:mb-0">
                        <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-wg-green" />
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={stageStyle(h.stage?.color)}
                          >
                            {h.stage?.name ?? "—"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDateTime(h.changedAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">por {h.changedBy}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
