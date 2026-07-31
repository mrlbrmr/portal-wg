"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Download, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDate, formatDateTime } from "@/lib/utils";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import { AssessmentsSection } from "@/components/internal/AssessmentsSection";
import type { KanbanStage } from "@/components/internal/KanbanBoard";

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
  stageId: string;
  stage: StageRef | null;
  source: string;
  addedBy: string | null;
  notes: string | null;
  createdAt: string;
  stageHistory: StageHistoryEntry[];
}

function stageStyle(color: string | undefined) {
  const c = color ?? "#94a3b8";
  return { backgroundColor: `${c}1f`, color: c };
}

interface Props {
  applicationId: string | null;
  canManage: boolean;
  stages: KanbanStage[];
  jobTitle?: string;
  jobLocation?: string;
  onClose: () => void;
}

export function CandidateDrawer({
  applicationId,
  canManage,
  stages,
  jobTitle,
  jobLocation,
  onClose,
}: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [data, setData] = useState<CandidateDetail | null>(null);
  const [error, setError] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  async function advanceStage() {
    if (!data || !applicationId) return;
    const currentIdx = stages.findIndex((s) => s.id === data.stageId);
    const nextStage = stages[currentIdx + 1];
    if (!nextStage) return;

    setAdvancing(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: nextStage.id }),
      });
      if (!res.ok) {
        notify("error", "Erro ao avançar etapa.");
        return;
      }
      notify("success", `${data.fullName} movido para ${nextStage.name}.`);
      setData((d) =>
        d
          ? {
              ...d,
              stageId: nextStage.id,
              stage: { name: nextStage.name, color: nextStage.color },
            }
          : d
      );
      router.refresh();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setAdvancing(false);
    }
  }

  function copyField(field: string, text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1500);
  }

  const dirty = data ? (data.notes ?? "") !== notes : false;

  const currentStepIdx = data ? stages.findIndex((s) => s.id === data.stageId) : -1;
  const canAdvance = canManage && currentStepIdx >= 0 && currentStepIdx < stages.length - 1;
  const phoneDigits = data ? data.phone.replace(/\D/g, "") : "";
  const whatsappUrl = phoneDigits ? `https://wa.me/55${phoneDigits}` : "#";
  const jobLabel = [jobTitle, jobLocation].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className="relative flex h-full w-full max-w-[480px] flex-col bg-white shadow-[-10px_0_34px_rgba(0,0,0,.16)] animate-in slide-in-from-right duration-200"
        style={{ overflowY: "hidden" }}
      >
        {/* ── Sticky header ── */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-5 pb-4 border-b border-[#EEF1E7] flex flex-col gap-3 shrink-0">
          {/* Name + close */}
          <div className="flex justify-between items-start gap-2.5">
            <div className="min-w-0 flex-1">
              {data ? (
                <>
                  <p className="text-[19px] font-extrabold text-[#1A2213] leading-tight">
                    {data.fullName}
                  </p>
                  {jobLabel && (
                    <p className="text-[12.5px] text-[#55614A] mt-0.5">{jobLabel}</p>
                  )}
                </>
              ) : (
                <Skeleton className="h-6 w-48" />
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="shrink-0 rounded-lg p-1 text-[#55614A] transition-colors hover:bg-[#EEF1E7] hover:text-[#1A2213]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Badges */}
          {data && (
            <div className="flex items-center gap-2 flex-wrap">
              {data.source && (
                <span className="bg-[#E4F3DA] text-[#2F5D1E] text-[10.5px] font-bold px-2.5 py-1 rounded-full">
                  via {APPLICATION_SOURCE_LABELS[data.source] ?? data.source}
                </span>
              )}
              {data.stage && (
                <span
                  className="text-[10.5px] font-bold px-2.5 py-1 rounded-full"
                  style={stageStyle(data.stage.color)}
                >
                  {data.stage.name.toUpperCase()}
                </span>
              )}
            </div>
          )}

          {/* Stepper */}
          {stages.length > 0 && (
            <div className="relative px-1 pt-0.5">
              <div className="absolute top-[14px] left-[20px] right-[20px] h-0.5 bg-[#E7EEDD] z-0" />
              <div className="flex justify-between relative z-10">
                {stages.map((s, i) => {
                  const done = currentStepIdx >= 0 && i < currentStepIdx;
                  const current = i === currentStepIdx;
                  return (
                    <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                        style={{
                          background: done
                            ? "#4F6930"
                            : current
                            ? "#90CB46"
                            : "#F1F3EC",
                          color: done || current ? "#fff" : "#8A9678",
                          border: `2px solid ${done ? "#4F6930" : current ? "#90CB46" : "#DCE8CC"}`,
                        }}
                      >
                        {done ? "✓" : i + 1}
                      </div>
                      <div
                        className="text-[9px] font-bold text-center leading-tight px-0.5"
                        style={{ color: current ? "#1A2213" : "#7B8869" }}
                      >
                        {s.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {data && (
            <div className="flex gap-2 items-center">
              {canAdvance && (
                <button
                  type="button"
                  onClick={advanceStage}
                  disabled={advancing}
                  className="flex-1 bg-[#90CB46] text-[#0C0D0C] px-3.5 py-2.5 rounded-[10px] text-[13px] font-bold whitespace-nowrap hover:bg-[#7FD400] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  {advancing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {advancing ? "Avançando…" : "Avançar de etapa ➔"}
                </button>
              )}
              {!canAdvance && currentStepIdx >= 0 && currentStepIdx === stages.length - 1 && (
                <div className="flex-1 text-center bg-[#EAF4DC] text-[#2F5D1E] px-3.5 py-2.5 rounded-[10px] text-[12.5px] font-bold">
                  🏆 Última etapa
                </div>
              )}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                title="Falar no WhatsApp"
                className="w-10 h-10 rounded-[10px] bg-[#25D366] text-white flex items-center justify-center text-[17px] shrink-0 hover:opacity-90 transition-opacity"
              >
                💬
              </a>
            </div>
          )}
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-8 flex flex-col gap-6">
          {error ? (
            <p className="text-sm text-red-600">Não foi possível carregar a ficha.</p>
          ) : !data ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="mt-4 h-28 w-full" />
            </div>
          ) : (
            <>
              {/* Currículo */}
              {data.resumeName ? (
                <a
                  href={`/api/applications/${data.id}/resume`}
                  className="flex items-center gap-3 bg-[#F6F8F3] border border-[#E7EEDD] rounded-xl px-3.5 py-3 cursor-pointer hover:bg-[#EEF4E3] transition-colors group"
                >
                  <span className="text-xl">📄</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#1A2213] text-[13.5px] font-bold">
                      Visualizar / Baixar currículo
                    </div>
                    <div className="text-[#55614A] text-[11.5px]">
                      PDF · enviado em {formatDate(data.createdAt)}
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-[#4F6930] shrink-0" />
                </a>
              ) : (
                <div className="flex items-center gap-3 bg-[#F6F8F3] border border-[#E7EEDD] rounded-xl px-3.5 py-3 opacity-60">
                  <span className="text-xl">📄</span>
                  <span className="text-[#55614A] text-[13.5px]">Sem currículo anexado</span>
                </div>
              )}

              {/* Contato */}
              <div>
                <div className="text-[#1A2213] text-[13px] font-bold mb-2">Contato</div>
                <div className="flex flex-col gap-1.5">
                  {[
                    { field: "email", icon: "✉", value: data.email },
                    { field: "telefone", icon: "☎", value: data.phone },
                  ].map((row) => (
                    <div
                      key={row.field}
                      className="flex items-center gap-2 bg-[#F6F8F3] border border-[#E7EEDD] rounded-[9px] px-3 py-2"
                    >
                      <span className="text-[#3E4A34] text-[12.5px] flex-1 min-w-0 truncate">
                        {row.icon} {row.value}
                      </span>
                      <button
                        type="button"
                        className="text-[#4F6930] text-[11px] font-bold shrink-0 hover:opacity-70 transition-opacity"
                        onClick={() => copyField(row.field, row.value)}
                      >
                        {copiedField === row.field ? "Copiado ✓" : "copiar"}
                      </button>
                    </div>
                  ))}
                </div>
                {data.addedBy && (
                  <p className="mt-2 text-[11px] text-[#9AA68A]">
                    Cadastrado por {data.addedBy} em {formatDate(data.createdAt)}
                  </p>
                )}
              </div>

              {/* Anotações */}
              <div>
                <label className="block text-[#1A2213] text-[13px] font-bold mb-2">
                  Anotações da equipe
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canManage}
                  rows={4}
                  placeholder={
                    canManage
                      ? "Observações sobre o candidato (visível só para o RH)..."
                      : "Sem anotações."
                  }
                  className="w-full resize-y bg-[#F6F8F3] border border-[#E7EEDD] rounded-[9px] px-3 py-2 text-[12.5px] text-[#1A2213] outline-none focus:border-[#90CB46] focus:ring-2 focus:ring-[#90CB46]/30 transition-colors disabled:opacity-60"
                />
                {canManage && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={saveNotes}
                      disabled={!dirty || saving}
                      className="inline-flex items-center gap-1.5 bg-[#90CB46] text-[#0C0D0C] px-3.5 py-1.5 rounded-[9px] text-[12.5px] font-bold hover:bg-[#7FD400] disabled:opacity-50 transition-colors"
                    >
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Salvar anotações
                    </button>
                  </div>
                )}
              </div>

              {/* Avaliações */}
              <AssessmentsSection applicationId={data.id} canManage={canManage} />

              {/* Histórico de etapas */}
              {data.stageHistory.length > 0 && (
                <div>
                  <div className="text-[#1A2213] text-[13px] font-bold mb-3">
                    Histórico de etapas
                  </div>
                  <div className="flex flex-col">
                    {data.stageHistory.map((h, i) => (
                      <div key={h.id} className="flex gap-3">
                        <div className="flex flex-col items-center w-3 shrink-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#90CB46] shrink-0" />
                          {i < data.stageHistory.length - 1 && (
                            <span className="w-0.5 flex-1 bg-[#DCE8CC] mt-0.5" />
                          )}
                        </div>
                        <div className="pb-4 min-w-0">
                          <span
                            className="text-[10.5px] font-bold px-2 py-0.5 rounded-md inline-block"
                            style={stageStyle(h.stage?.color)}
                          >
                            {h.stage?.name ?? "—"}
                          </span>
                          <span className="text-[#55614A] text-[11.5px] ml-1.5">
                            {formatDateTime(h.changedAt)}
                          </span>
                          <div className="text-[#3E4A34] text-[11.5px] mt-0.5">
                            por {h.changedBy}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.stageHistory.length === 0 && (
                <p className="text-sm text-[#9AA68A]">Sem movimentações registradas ainda.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
