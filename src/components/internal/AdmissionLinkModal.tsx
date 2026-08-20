"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

interface MetaOption { id: string; name: string; }

export interface AdmissionMeta {
  positions: MetaOption[];
  companies: MetaOption[];
  branches: MetaOption[];
  intakeStageId: string | null;
}

export interface AdmissionCandidate {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  jobId: string;
}

interface Props {
  open: boolean;
  candidate: AdmissionCandidate | null;
  meta: AdmissionMeta | null;
  onClose: () => void;
  /** Chamado após o usuário clicar "Fechar": o pai deve mover o card no ATS. */
  onSuccess: (admissionId: string) => void;
}

type Step = "form" | "success";

interface SuccessData {
  admissionId: string;
  formUrl: string;
  whatsappMessage: string;
}

export function AdmissionLinkModal({ open, candidate, meta, onClose, onSuccess }: Props) {
  const { notify } = useToast();
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<"url" | "msg" | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const [startDate, setStartDate] = useState("");
  const [positionId, setPositionId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    if (open) {
      setStep("form");
      setSubmitting(false);
      setCopied(null);
      setSuccessData(null);
      setStartDate("");
      setPositionId("");
      setCompanyId("");
      setBranchId("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open || step === "success") return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, step, onClose]);

  if (!open || !candidate || !meta) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate) { notify("error", "Informe a data prevista de admissão."); return; }
    if (!meta!.intakeStageId) {
      notify("error", "Configure o estágio \"Envio do formulário admissional\" nas Configurações de Admissão antes de usar esta função.");
      return;
    }

    setSubmitting(true);
    try {
      const admRes = await fetch("/api/admissoes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: candidate!.fullName,
          email: candidate!.email,
          phone: candidate!.phone,
          startDate,
          positionId: positionId || null,
          companyId: companyId || null,
          branchId: branchId || null,
          stageId: meta!.intakeStageId,
          sourceApplicationId: candidate!.id,
          sourceJobId: candidate!.jobId,
        }),
      });
      if (!admRes.ok) {
        const d = await admRes.json().catch(() => ({}));
        notify("error", (d as { error?: string }).error ?? "Erro ao criar admissão.");
        return;
      }
      const { id: admissionId } = await admRes.json() as { id: string };

      const linkRes = await fetch(`/api/admissoes/${admissionId}/digital/start`, {
        method: "POST",
        credentials: "same-origin",
      });

      let formUrl = "";
      let whatsappMessage = "";
      if (linkRes.ok) {
        const d = await linkRes.json() as { formUrl: string; whatsappMessage: string };
        formUrl = d.formUrl;
        whatsappMessage = d.whatsappMessage;
      } else {
        notify("error", "Admissão criada, mas houve erro ao gerar o link do formulário.");
      }

      setSuccessData({ admissionId, formUrl, whatsappMessage });
      setStep("success");
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function copy(type: "url" | "msg", text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(type);
    setTimeout(() => setCopied((c) => (c === type ? null : c)), 2000);
  }

  function handleClose() {
    if (step === "success" && successData) {
      onSuccess(successData.admissionId);
    } else {
      onClose();
    }
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={step === "form" ? onClose : undefined} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-[16px] font-extrabold text-[#1A2213]">
              {step === "form" ? "Iniciar admissão" : "Admissão criada!"}
            </h2>
            <p className="text-[12px] text-[#55614A] mt-0.5">{candidate.fullName}</p>
          </div>
          {step === "form" && (
            <button type="button" onClick={onClose} className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {step === "form" ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="rounded-xl bg-[#F6F8F3] border border-[#E7EEDD] px-4 py-3 flex flex-col gap-1">
                <p className="text-[11px] text-[#9AA68A] font-medium">Candidato</p>
                <p className="text-[13.5px] font-bold text-[#1A2213]">{candidate.fullName}</p>
                <p className="text-[12px] text-[#55614A]">{candidate.email} · {candidate.phone}</p>
              </div>

              <div>
                <label className="block text-[12.5px] font-bold text-[#1A2213] mb-1">
                  Data prevista de admissão <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#1A2213] focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#55614A] mb-1">Cargo</label>
                  <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-[#1A2213] focus:border-wg-green focus:outline-none">
                    <option value="">— Selecione —</option>
                    {meta.positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#55614A] mb-1">Empresa</label>
                  <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-[#1A2213] focus:border-wg-green focus:outline-none">
                    <option value="">— Selecione —</option>
                    {meta.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#55614A] mb-1">Filial</label>
                  <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-[#1A2213] focus:border-wg-green focus:outline-none">
                    <option value="">— Selecione —</option>
                    {meta.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="mt-2 w-full bg-[#90CB46] text-[#0C0D0C] px-4 py-3 rounded-[10px] text-[13.5px] font-bold hover:bg-[#7FD400] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Criando admissão…" : "Criar admissão e gerar link"}
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <p className="text-[13px] font-bold text-[#166534]">Admissão iniciada! O formulário digital está pronto para enviar.</p>
              </div>

              {successData?.formUrl && (
                <>
                  <div>
                    <p className="text-[12px] font-bold text-[#1A2213] mb-1">Link do formulário digital</p>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <span className="flex-1 truncate text-[12px] text-[#4F6930] font-mono">{successData.formUrl}</span>
                      <button type="button" onClick={() => copy("url", successData.formUrl)} className="shrink-0 text-[#4F6930] hover:opacity-70 transition-opacity" title="Copiar link">
                        {copied === "url" ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {successData.whatsappMessage && (
                    <div>
                      <p className="text-[12px] font-bold text-[#1A2213] mb-1">Mensagem para WhatsApp</p>
                      <div className="relative rounded-lg border border-gray-200 bg-gray-50">
                        <textarea readOnly rows={5} value={successData.whatsappMessage} className="w-full resize-none bg-transparent px-3 py-2 text-[11.5px] text-[#3E4A34] focus:outline-none" />
                        <button type="button" onClick={() => copy("msg", successData.whatsappMessage)} className="absolute top-2 right-2 text-[#4F6930] hover:opacity-70 transition-opacity" title="Copiar mensagem">
                          {copied === "msg" ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 mt-1">
                <a href={`/admissoes/${successData?.admissionId}`} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-[#DCE8CC] bg-[#F6F8F3] px-4 py-2.5 text-[13px] font-bold text-[#1A2213] hover:bg-[#EEF4E3] transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  Ver admissão
                </a>
                <button type="button" onClick={handleClose} className="flex-1 bg-[#90CB46] text-[#0C0D0C] px-4 py-2.5 rounded-[10px] text-[13px] font-bold hover:bg-[#7FD400] transition-colors">
                  Fechar e mover candidato
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
