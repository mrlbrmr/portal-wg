"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ExternalLink, X, Download, Loader2, Edit2, Upload, UserX } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDate, formatDateTime } from "@/lib/utils";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import { AssessmentsSection } from "@/components/internal/AssessmentsSection";
import { TestSessionsSection } from "@/components/internal/TestSessionsSection";
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
  country: string | null;
  candidateCity: string | null;
  availablePresential: boolean | null;
  salaryExpectation: number | null;
  stageHistory: StageHistoryEntry[];
}

interface EditForm {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  candidateCity: string;
  availablePresential: "" | "true" | "false";
  salaryExpectation: string;
}

// ── Helpers de cor (WCAG AA: texto escuro sobre fundo levemente tintado) ──

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function darkenForText(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#1A2213";
  // Multiplica por 0.45 para garantir contraste ≥ 4.5:1 sobre fundo quase-branco
  return "#" + rgb.map((c) => Math.round(c * 0.45).toString(16).padStart(2, "0")).join("");
}

function stageStyle(color: string | undefined) {
  const c = color ?? "#94a3b8";
  return { backgroundColor: `${c}26`, color: darkenForText(c) };
}

function formatPhoneMask(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
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
  const [notesSaveState, setNotesSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [notesSavedAt, setNotesSavedAt] = useState<Date | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [linkedAdmission, setLinkedAdmission] = useState<{
    id: string;
    startDate: string | null;
    digitalFormSubmittedAt: string | null;
    stage: { name: string; color: string } | null;
  } | null>(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    candidateCity: "",
    availablePresential: "",
    salaryExpectation: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const resumeFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!applicationId) return;
    let active = true;
    setData(null);
    setError(false);
    setEditing(false);
    setLinkedAdmission(null);
    setNotesSaveState("idle");
    setNotesSavedAt(null);

    Promise.all([
      fetch(`/api/applications/${applicationId}`, { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: CandidateDetail) => {
          if (!active) return;
          setData(d);
          setNotes(d.notes ?? "");
          setEditForm({
            fullName: d.fullName,
            email: d.email,
            phone: formatPhoneMask(d.phone),
            country: d.country ?? "",
            candidateCity: d.candidateCity ?? "",
            availablePresential:
              d.availablePresential === null ? "" : d.availablePresential ? "true" : "false",
            salaryExpectation:
              d.salaryExpectation !== null ? String(d.salaryExpectation) : "",
          });
        })
        .catch(() => { if (active) setError(true); }),
      fetch(`/api/applications/${applicationId}/admission`, { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (active) setLinkedAdmission(d); })
        .catch(() => {}),
    ]);

    return () => { active = false; };
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [applicationId, onClose]);

  useEffect(() => {
    if (!applicationId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [applicationId]);

  useEffect(() => {
    return () => { if (notesTimerRef.current) clearTimeout(notesTimerRef.current); };
  }, []);

  if (!applicationId) return null;

  // ── Etapas de progressão (exclui LOST do funil linear) ──
  const progressionStages = stages.filter((s) => s.kind !== "LOST");
  const lostStage = stages.find((s) => s.kind === "LOST") ?? null;
  const currentOpenIdx = data ? progressionStages.findIndex((s) => s.id === data.stageId) : -1;
  const isInLostStage = data
    ? stages.find((s) => s.id === data.stageId)?.kind === "LOST"
    : false;
  const nextOpenStage = currentOpenIdx >= 0 ? progressionStages[currentOpenIdx + 1] : null;
  const nextIsAdmission = nextOpenStage?.kind === "ADMISSION";
  const canAdvance =
    canManage &&
    currentOpenIdx >= 0 &&
    currentOpenIdx < progressionStages.length - 1 &&
    !nextIsAdmission &&
    !isInLostStage;
  const canReprove = canManage && !!lostStage && !isInLostStage && !!data;

  // ── Funções ──

  const persistNotes = async (value: string) => {
    if (!applicationId) return;
    setNotesSaveState("saving");
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value.trim() ? value : null }),
      });
      if (!res.ok) {
        notify("error", "Erro ao salvar as anotações.");
        setNotesSaveState("idle");
        return;
      }
      setData((d) => (d ? { ...d, notes: value } : d));
      setNotesSavedAt(new Date());
      setNotesSaveState("saved");
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
      setNotesSaveState("idle");
    }
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (!canManage) return;
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => persistNotes(value), 1000);
  };

  const changeStage = async (stageId: string) => {
    if (!data || !applicationId) return;
    const target = stages.find((s) => s.id === stageId);
    if (!target) return;
    setAdvancing(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      if (!res.ok) {
        notify("error", "Erro ao alterar etapa.");
        return;
      }
      notify("success", `${data.fullName} movido para ${target.name}.`);
      setData((d) =>
        d ? { ...d, stageId: target.id, stage: { name: target.name, color: target.color } } : d
      );
      router.refresh();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setAdvancing(false);
    }
  };

  const advanceStage = async () => {
    if (!data) return;
    const next = progressionStages[currentOpenIdx + 1];
    if (!next) return;
    await changeStage(next.id);
  };

  const saveProfile = async () => {
    if (!applicationId) return;
    const phoneDigits = editForm.phone.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      notify("error", "Telefone inválido. Informe 11 dígitos (DDD + número).");
      return;
    }
    if (editForm.fullName.trim().length < 2) {
      notify("error", "Nome completo inválido.");
      return;
    }
    setSavingProfile(true);
    try {
      const salary = editForm.salaryExpectation
        ? parseFloat(editForm.salaryExpectation.replace(",", "."))
        : null;
      const body: Record<string, unknown> = {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        phone: phoneDigits,
        country: editForm.country.trim() || null,
        candidateCity: editForm.candidateCity.trim() || null,
        availablePresential:
          editForm.availablePresential === ""
            ? null
            : editForm.availablePresential === "true",
        salaryExpectation: salary !== null && !isNaN(salary) ? salary : null,
      };
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        notify("error", "Erro ao salvar os dados.");
        return;
      }
      notify("success", "Dados do candidato atualizados.");
      setData((d) =>
        d
          ? {
              ...d,
              fullName: body.fullName as string,
              email: body.email as string,
              phone: phoneDigits,
              country: body.country as string | null,
              candidateCity: body.candidateCity as string | null,
              availablePresential: body.availablePresential as boolean | null,
              salaryExpectation: body.salaryExpectation as number | null,
            }
          : d
      );
      setEditing(false);
      router.refresh();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResumeReplace = async (file: File) => {
    if (!applicationId) return;
    setUploadingResume(true);
    try {
      const form = new FormData();
      form.append("resume", file);
      const res = await fetch(`/api/applications/${applicationId}/resume`, {
        method: "PUT",
        credentials: "same-origin",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify("error", (err as { error?: string }).error ?? "Erro ao substituir o currículo.");
        return;
      }
      const { resumeName } = (await res.json()) as { resumeName: string };
      notify("success", "Currículo atualizado.");
      setData((d) => (d ? { ...d, resumeName } : d));
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setUploadingResume(false);
    }
  };

  const copyField = (field: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1500);
  };

  // ── Valores derivados de UI ──
  const phoneDigits = data ? data.phone.replace(/\D/g, "") : "";
  const whatsappUrl = phoneDigits ? `https://wa.me/55${phoneDigits}` : "#";
  const jobLabel = [jobTitle, jobLocation].filter(Boolean).join(" · ");

  const notesSavedLabel =
    notesSaveState === "saving"
      ? "Salvando…"
      : notesSaveState === "saved" && notesSavedAt
      ? `Salvo às ${notesSavedAt.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : null;

  const inputCls =
    "w-full bg-[#F6F8F3] border border-[#E7EEDD] rounded-[9px] px-3 py-2 text-[12.5px] text-[#1A2213] outline-none focus:border-[#90CB46] focus:ring-2 focus:ring-[#90CB46]/30 transition-colors placeholder:text-[#B5BEA8]";
  const labelCls = "block text-[10.5px] font-bold text-[#55614A] mb-1";

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <input
        ref={resumeFileRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleResumeReplace(file);
          e.target.value = "";
        }}
      />

      <div
        className="relative flex h-full w-full max-w-[620px] flex-col bg-white shadow-[-10px_0_34px_rgba(0,0,0,.16)] animate-in slide-in-from-right duration-200"
        style={{ overflowY: "auto" }}
      >
        {/* ── Sticky header ── */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-5 pb-4 border-b border-[#EEF1E7] flex flex-col gap-3 shrink-0">
          {/* Nome + ações + fechar */}
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
            <div className="flex items-center gap-1.5 shrink-0">
              {canManage && data && !editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold text-[#4F6930] bg-[#EEF1E7] hover:bg-[#DCE8CC] transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Editar
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-lg p-1 text-[#55614A] transition-colors hover:bg-[#EEF1E7] hover:text-[#1A2213]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Badges: fonte e etapa atual */}
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

          {/* Seletor de etapa — substitui o stepper truncado */}
          {progressionStages.length > 0 && data && (
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-medium text-[#7B8869] shrink-0 whitespace-nowrap">
                {isInLostStage
                  ? "Desfecho:"
                  : `Etapa ${currentOpenIdx >= 0 ? currentOpenIdx + 1 : "—"} de ${progressionStages.length}:`}
              </span>
              <select
                value={data.stageId}
                onChange={(e) => { if (canManage && !advancing) changeStage(e.target.value); }}
                disabled={!canManage || advancing}
                aria-label="Selecionar etapa do candidato"
                className="flex-1 min-w-0 rounded-lg border border-[#E7EEDD] bg-[#F6F8F3] px-2.5 py-1.5 text-[12px] font-bold text-[#1A2213] outline-none focus:border-[#90CB46] focus:ring-2 focus:ring-[#90CB46]/20 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {progressionStages.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {i + 1}. {s.name}
                  </option>
                ))}
                {lostStage && (
                  <>
                    <option disabled value="">──────────────</option>
                    <option value={lostStage.id}>{lostStage.name}</option>
                  </>
                )}
              </select>
            </div>
          )}

          {/* Botões de ação */}
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
              {!canAdvance && nextIsAdmission && (
                <div className="flex-1 text-center bg-indigo-50 text-indigo-700 px-3.5 py-2.5 rounded-[10px] text-[12px] font-medium">
                  Mova pelo Kanban para iniciar a admissão
                </div>
              )}
              {!canAdvance &&
                !nextIsAdmission &&
                !isInLostStage &&
                currentOpenIdx >= 0 &&
                currentOpenIdx === progressionStages.length - 1 && (
                  <div className="flex-1 text-center bg-[#EAF4DC] text-[#2F5D1E] px-3.5 py-2.5 rounded-[10px] text-[12.5px] font-bold">
                    🏆 Última etapa
                  </div>
                )}
              {isInLostStage && (
                <div className="flex-1 text-center bg-red-50 text-red-700 px-3.5 py-2.5 rounded-[10px] text-[12.5px] font-bold">
                  Candidato reprovado
                </div>
              )}
              {/* Botão de reprovação rápida — separado do fluxo linear */}
              {canReprove && (
                <button
                  type="button"
                  onClick={() => lostStage && changeStage(lostStage.id)}
                  disabled={advancing}
                  title="Reprovar este candidato"
                  className="px-3 py-2.5 rounded-[10px] border border-red-200 text-[12.5px] font-bold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 shrink-0"
                >
                  <UserX className="h-4 w-4" />
                  Reprovar
                </button>
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

        {/* ── Conteúdo com scroll ── */}
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
              <div className="flex items-stretch gap-2">
                {data.resumeName ? (
                  <a
                    href={`/api/applications/${data.id}/resume`}
                    className="flex-1 flex items-center gap-3 bg-[#F6F8F3] border border-[#E7EEDD] rounded-xl px-3.5 py-3 cursor-pointer hover:bg-[#EEF4E3] transition-colors"
                  >
                    <span className="text-xl">📄</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[#1A2213] text-[13.5px] font-bold truncate">
                        {data.resumeName}
                      </div>
                      <div className="text-[#55614A] text-[11.5px]">Visualizar / Baixar</div>
                    </div>
                    <Download className="w-4 h-4 text-[#4F6930] shrink-0" />
                  </a>
                ) : (
                  <div className="flex-1 flex items-center gap-3 bg-[#F6F8F3] border border-[#E7EEDD] rounded-xl px-3.5 py-3 opacity-60">
                    <span className="text-xl">📄</span>
                    <span className="text-[#55614A] text-[13.5px]">Sem currículo anexado</span>
                  </div>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => resumeFileRef.current?.click()}
                    disabled={uploadingResume}
                    title={data.resumeName ? "Substituir currículo" : "Anexar currículo"}
                    className="flex items-center gap-1.5 bg-[#F6F8F3] border border-[#E7EEDD] rounded-xl px-3 py-2.5 text-[11.5px] font-bold text-[#4F6930] hover:bg-[#EEF4E3] disabled:opacity-50 transition-colors shrink-0"
                  >
                    {uploadingResume ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploadingResume ? "Enviando…" : data.resumeName ? "Substituir" : "Anexar"}
                  </button>
                )}
              </div>

              {/* Edição ou exibição de dados */}
              {editing ? (
                <div className="flex flex-col gap-4 bg-[#F6F8F3] border border-[#E7EEDD] rounded-xl p-4">
                  <div className="text-[#1A2213] text-[13px] font-bold">
                    Editar dados do candidato
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Nome completo</label>
                      <input
                        type="text"
                        value={editForm.fullName}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, fullName: e.target.value }))
                        }
                        maxLength={120}
                        className={inputCls}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>E-mail</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, email: e.target.value }))
                        }
                        className={inputCls}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Telefone (com DDD)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            phone: formatPhoneMask(e.target.value),
                          }))
                        }
                        className={inputCls}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Cidade</label>
                      <input
                        type="text"
                        value={editForm.candidateCity}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, candidateCity: e.target.value }))
                        }
                        maxLength={120}
                        className={inputCls}
                        placeholder="Ex: São Paulo"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>País de origem</label>
                      <input
                        type="text"
                        value={editForm.country}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, country: e.target.value }))
                        }
                        maxLength={80}
                        className={inputCls}
                        placeholder="Ex: Brasil"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Pretensão salarial (R$)</label>
                      <input
                        type="number"
                        value={editForm.salaryExpectation}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, salaryExpectation: e.target.value }))
                        }
                        min={0}
                        step={100}
                        className={inputCls}
                        placeholder="Ex: 3500"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Disponibilidade presencial</label>
                      <select
                        value={editForm.availablePresential}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            availablePresential: e.target.value as "" | "true" | "false",
                          }))
                        }
                        className={inputCls}
                      >
                        <option value="">Não informado</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={savingProfile}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#90CB46] text-[#0C0D0C] px-3.5 py-2 rounded-[9px] text-[12.5px] font-bold hover:bg-[#7FD400] disabled:opacity-50 transition-colors"
                    >
                      {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {savingProfile ? "Salvando…" : "Salvar alterações"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      disabled={savingProfile}
                      className="px-3.5 py-2 rounded-[9px] text-[12.5px] font-bold text-[#55614A] bg-[#EEF1E7] hover:bg-[#DCE8CC] disabled:opacity-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
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

                  {/* Ficha de inscrição — grid 2 colunas */}
                  {(data.country ||
                    data.candidateCity ||
                    data.availablePresential !== null ||
                    data.salaryExpectation !== null) && (
                    <div>
                      <div className="text-[#1A2213] text-[13px] font-bold mb-2">
                        Ficha de inscrição
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {data.country && (
                          <div className="flex items-center gap-2 bg-[#F6F8F3] border border-[#E7EEDD] rounded-[9px] px-3 py-2">
                            <span className="text-base leading-none shrink-0">🌍</span>
                            <div className="min-w-0">
                              <span className="text-[10.5px] text-[#9AA68A] block">País</span>
                              <span className="text-[#1A2213] text-[12.5px] font-medium truncate block">
                                {data.country}
                              </span>
                            </div>
                          </div>
                        )}
                        {data.candidateCity && (
                          <div className="flex items-center gap-2 bg-[#F6F8F3] border border-[#E7EEDD] rounded-[9px] px-3 py-2">
                            <span className="text-base leading-none shrink-0">📍</span>
                            <div className="min-w-0">
                              <span className="text-[10.5px] text-[#9AA68A] block">Cidade</span>
                              <span className="text-[#1A2213] text-[12.5px] font-medium truncate block">
                                {data.candidateCity}
                              </span>
                            </div>
                          </div>
                        )}
                        {data.availablePresential !== null && (
                          <div className="flex items-center gap-2 bg-[#F6F8F3] border border-[#E7EEDD] rounded-[9px] px-3 py-2">
                            <span className="text-base leading-none shrink-0">🏢</span>
                            <div className="min-w-0">
                              <span className="text-[10.5px] text-[#9AA68A] block">Presencial</span>
                              <span
                                className={`text-[12.5px] font-semibold block ${
                                  data.availablePresential ? "text-[#2F6A1E]" : "text-[#9B3B2E]"
                                }`}
                              >
                                {data.availablePresential ? "Sim" : "Não"}
                              </span>
                            </div>
                          </div>
                        )}
                        {data.salaryExpectation !== null && (
                          <div className="flex items-center gap-2 bg-[#F6F8F3] border border-[#E7EEDD] rounded-[9px] px-3 py-2">
                            <span className="text-base leading-none shrink-0">💰</span>
                            <div className="min-w-0">
                              <span className="text-[10.5px] text-[#9AA68A] block">Pretensão</span>
                              <span className="text-[#1A2213] text-[12.5px] font-medium tabular-nums block">
                                {new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(data.salaryExpectation)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Anotações com auto-save */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="candidate-notes"
                    className="text-[#1A2213] text-[13px] font-bold"
                  >
                    Anotações da equipe
                  </label>
                  {notesSavedLabel && (
                    <span className="text-[10.5px] text-[#9AA68A] flex items-center gap-1">
                      {notesSaveState === "saving" && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {notesSavedLabel}
                    </span>
                  )}
                </div>
                <textarea
                  id="candidate-notes"
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
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
                      onClick={() => {
                        if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
                        persistNotes(notes);
                      }}
                      disabled={notesSaveState === "saving"}
                      className="inline-flex items-center gap-1.5 bg-[#90CB46] text-[#0C0D0C] px-3.5 py-1.5 rounded-[9px] text-[12.5px] font-bold hover:bg-[#7FD400] disabled:opacity-50 transition-colors"
                    >
                      {notesSaveState === "saving" && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Salvar anotações
                    </button>
                  </div>
                )}
              </div>

              {/* Avaliações */}
              <AssessmentsSection
                applicationId={data.id}
                canManage={canManage}
                hasResume={!!data.resumeName}
              />

              {/* Testes Online */}
              <TestSessionsSection
                applicationId={data.id}
                canManage={canManage}
                defaultTemplateId={
                  stages.find((s) => s.id === data.stageId && s.kind === "TEST")
                    ?.templateId ?? null
                }
              />

              {/* Admissão vinculada */}
              {linkedAdmission && (
                <div className="border border-indigo-200 bg-indigo-50 rounded-xl px-3.5 py-3">
                  <div className="text-[12px] font-bold text-indigo-800 mb-2">Admissão</div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      {linkedAdmission.stage && (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-md inline-block w-fit"
                          style={{
                            backgroundColor: `${linkedAdmission.stage.color}20`,
                            color: darkenForText(linkedAdmission.stage.color),
                          }}
                        >
                          {linkedAdmission.stage.name}
                        </span>
                      )}
                      {linkedAdmission.startDate && (
                        <p className="text-[11.5px] text-indigo-700">
                          Início previsto: {formatDate(linkedAdmission.startDate)}
                        </p>
                      )}
                      {linkedAdmission.digitalFormSubmittedAt ? (
                        <p className="text-[11.5px] text-green-700 font-medium">
                          ✓ Formulário preenchido
                        </p>
                      ) : (
                        <p className="text-[11.5px] text-amber-700">
                          Formulário pendente de preenchimento
                        </p>
                      )}
                    </div>
                    <a
                      href={`/admissoes/${linkedAdmission.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 text-[11.5px] font-bold text-indigo-700 hover:opacity-80 transition-opacity"
                    >
                      Ver admissão
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Histórico de etapas — texto fluído */}
              {data.stageHistory.length > 0 ? (
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
                        <div className="pb-4 min-w-0 flex-1">
                          <p className="text-[11.5px] text-[#3E4A34] leading-relaxed">
                            Movido para{" "}
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-bold align-middle"
                              style={stageStyle(h.stage?.color)}
                            >
                              {h.stage?.name ?? "—"}
                            </span>{" "}
                            por <span className="font-semibold">{h.changedBy}</span>{" "}
                            <span className="text-[#9AA68A]">
                              em {formatDateTime(h.changedAt)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#9AA68A]">Sem movimentações registradas ainda.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
