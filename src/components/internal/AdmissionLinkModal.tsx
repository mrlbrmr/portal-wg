"use client";

// "Contratar candidato" — aberto pelo pipeline quando o candidato entra numa etapa de
// admissão/contratado. Cria a admissão, gera o link do formulário digital e, em vaga
// específica, OCUPA UMA POSIÇÃO da vaga (o RH escolhe qual). A posição é preenchida no
// servidor com trava de linha: uma posição ocupada nunca recebe um segundo contratado.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog } from "@/components/ui/Dialog";
import { Button, buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { positionLabel } from "@/lib/jobs/positions";
import { closeFilledJobAction } from "@/lib/jobs/position-actions";

interface MetaOption {
  id: string;
  name: string;
}

export interface AdmissionMeta {
  positions: MetaOption[];
  companies: MetaOption[];
  branches: MetaOption[];
  intakeStageId: string | null;
}

/** Posição da vaga, como o modal precisa dela. */
export interface AdmissionPosition {
  id: string;
  positionNumber: number;
  status: "OPEN" | "FILLED" | "CANCELLED";
  candidateName: string | null;
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
  /** Posições da vaga. null = vaga sem posições (banco de talentos): não pede posição. */
  positions?: AdmissionPosition[] | null;
  onClose: () => void;
  /** Chamado após o usuário clicar "Fechar": o pai deve mover o card no ATS. */
  onSuccess: (admissionId: string) => void;
}

type Step = "form" | "success";

interface SuccessData {
  admissionId: string;
  formUrl: string;
  whatsappMessage: string;
  positionNumber: number | null;
  allFilled: boolean;
}

const selectClass =
  "w-full h-9 rounded-control border border-wg-border-light bg-white px-2 text-sm text-wg-ink focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30";

export function AdmissionLinkModal({ open, candidate, meta, positions = null, onClose, onSuccess }: Props) {
  const { notify } = useToast();
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<"url" | "msg" | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [closingJob, setClosingJob] = useState<"idle" | "busy" | "done" | "kept">("idle");

  const [startDate, setStartDate] = useState("");
  const [positionId, setPositionId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [jobPositionId, setJobPositionId] = useState("");

  const openPositions = (positions ?? []).filter((p) => p.status === "OPEN").sort((a, b) => a.positionNumber - b.positionNumber);
  const usesPositions = positions !== null;

  useEffect(() => {
    if (open) {
      setStep("form");
      setSubmitting(false);
      setCopied(null);
      setSuccessData(null);
      setClosingJob("idle");
      setStartDate("");
      setPositionId("");
      setCompanyId("");
      setBranchId("");
      setJobPositionId("");
    }
  }, [open]);

  if (!open || !candidate || !meta) return null;

  const selectedPosition = jobPositionId || openPositions[0]?.id || "";
  const blocked = usesPositions && openPositions.length === 0;

  async function handleSubmit() {
    if (!startDate) {
      notify("error", "Informe a data prevista de admissão.");
      return;
    }
    if (!meta!.intakeStageId) {
      notify(
        "error",
        'Configure o estágio "Envio do formulário admissional" nas Configurações de Admissão antes de usar esta função.'
      );
      return;
    }
    if (usesPositions && !selectedPosition) {
      notify("error", "Selecione a posição que o candidato vai ocupar.");
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
          jobPositionId: usesPositions ? selectedPosition : null,
        }),
      });
      const admBody = (await admRes.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        position?: { number?: number; allFilled?: boolean } | null;
      };
      if (!admRes.ok || !admBody.id) {
        notify("error", admBody.error ?? "Erro ao criar admissão.");
        return;
      }
      const admissionId = admBody.id;

      const linkRes = await fetch(`/api/admissoes/${admissionId}/digital/start`, {
        method: "POST",
        credentials: "same-origin",
      });

      let formUrl = "";
      let whatsappMessage = "";
      if (linkRes.ok) {
        const d = (await linkRes.json()) as { formUrl: string; whatsappMessage: string };
        formUrl = d.formUrl;
        whatsappMessage = d.whatsappMessage;
      } else {
        notify("error", "Admissão criada, mas houve erro ao gerar o link do formulário.");
      }

      setSuccessData({
        admissionId,
        formUrl,
        whatsappMessage,
        positionNumber: admBody.position?.number ?? null,
        allFilled: Boolean(admBody.position?.allFilled),
      });
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
    if (step === "success" && successData) onSuccess(successData.admissionId);
    else onClose();
  }

  async function closeJob() {
    setClosingJob("busy");
    const res = await closeFilledJobAction(candidate!.jobId);
    if (!res.ok) {
      setClosingJob("idle");
      notify("error", res.error);
      return;
    }
    setClosingJob("done");
    notify("success", "Vaga encerrada. Novas candidaturas foram bloqueadas.");
  }

  const formFooter = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={submitting}>
        Cancelar
      </Button>
      <Button variant="primary" loading={submitting} disabled={blocked} onClick={handleSubmit}>
        Confirmar contratação
      </Button>
    </>
  );

  const successFooter = (
    <>
      <Link
        href={`/admissoes/${successData?.admissionId}`}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: "secondary" })}
      >
        <ExternalLink aria-hidden />
        Ver admissão
      </Link>
      <Button variant="primary" onClick={handleClose}>
        Fechar e mover candidato
      </Button>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={step === "form" ? onClose : handleClose}
      busy={submitting || closingJob === "busy"}
      title={step === "form" ? `Contratar ${candidate.fullName}` : "Contratação registrada"}
      description={
        step === "form"
          ? usesPositions
            ? "Inicia a admissão, gera o link do formulário digital e ocupa uma posição da vaga."
            : "Inicia a admissão e gera o link do formulário digital."
          : candidate.fullName
      }
      footer={step === "form" ? formFooter : successFooter}
    >
      {step === "form" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-control border border-wg-border-lighter bg-wg-bg px-3 py-2.5">
            <p className="text-body font-semibold text-wg-ink">{candidate.fullName}</p>
            <p className="text-meta text-wg-ink-muted">
              {candidate.email} · {candidate.phone}
            </p>
          </div>

          {usesPositions &&
            (blocked ? (
              <div className="rounded-control border border-warning-border bg-warning-bg px-3 py-2.5 text-meta text-warning-fg">
                <p className="font-semibold">Todas as posições desta vaga estão preenchidas.</p>
                <p className="mt-0.5">
                  Uma posição ocupada não recebe outro contratado. Para contratar mais alguém, adicione uma posição (fica registrado
                  no histórico) ou libere uma posição em caso de desistência.
                </p>
                <Link
                  href={`/vagas/${candidate.jobId}/editar#posicoes`}
                  className="mt-1.5 inline-block font-semibold underline-offset-2 hover:underline"
                >
                  Gerenciar posições da vaga
                </Link>
              </div>
            ) : (
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium text-wg-ink-secondary">
                  Selecione a posição <span className="text-danger-fg">*</span>
                </legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {openPositions.map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2 transition-colors",
                        selectedPosition === p.id ? "border-wg-green bg-wg-sidebar/60" : "border-wg-border-light hover:bg-wg-bg"
                      )}
                    >
                      <input
                        type="radio"
                        name="job-position"
                        checked={selectedPosition === p.id}
                        onChange={() => setJobPositionId(p.id)}
                        className="h-4 w-4 accent-wg-green"
                      />
                      <span className="text-body font-medium text-wg-ink">Posição {positionLabel(p.positionNumber)}</span>
                      <span className="ml-auto text-meta text-wg-ink-muted">Em aberto</span>
                    </label>
                  ))}
                </div>
                {(positions ?? []).some((p) => p.status === "FILLED") && (
                  <p className="mt-1.5 text-meta text-wg-ink-muted">
                    Já preenchidas:{" "}
                    {(positions ?? [])
                      .filter((p) => p.status === "FILLED")
                      .map((p) => `${positionLabel(p.positionNumber)}${p.candidateName ? ` (${p.candidateName})` : ""}`)
                      .join(", ")}
                  </p>
                )}
              </fieldset>
            ))}

          <div>
            <label htmlFor="adm-start" className="mb-1 block text-[13px] font-medium text-wg-ink-secondary">
              Data prevista de admissão <span className="text-danger-fg">*</span>
            </label>
            <input
              id="adm-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={cn(selectClass, "max-w-[220px] px-3")}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="adm-role" className="mb-1 block text-[12.5px] font-medium text-wg-ink-muted">
                Cargo
              </label>
              <select id="adm-role" value={positionId} onChange={(e) => setPositionId(e.target.value)} className={selectClass}>
                <option value="">Selecione</option>
                {meta.positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="adm-company" className="mb-1 block text-[12.5px] font-medium text-wg-ink-muted">
                Empresa
              </label>
              <select id="adm-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={selectClass}>
                <option value="">Selecione</option>
                {meta.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="adm-branch" className="mb-1 block text-[12.5px] font-medium text-wg-ink-muted">
                Filial
              </label>
              <select id="adm-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectClass}>
                <option value="">Selecione</option>
                {meta.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-control border border-success-border bg-success-bg px-3 py-2.5 text-success-fg">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="text-body">
              <p className="font-semibold">Admissão iniciada.</p>
              {successData?.positionNumber != null && (
                <p className="text-meta">Posição {positionLabel(successData.positionNumber)} preenchida por {candidate.fullName}.</p>
              )}
            </div>
          </div>

          {successData?.allFilled && closingJob !== "kept" && (
            <div className="rounded-control border border-info-border bg-info-bg px-3 py-2.5 text-info-fg">
              {closingJob === "done" ? (
                <p className="text-body font-semibold">Vaga encerrada — novas candidaturas bloqueadas.</p>
              ) : (
                <>
                  <p className="text-body font-semibold">Todas as posições desta vaga foram preenchidas.</p>
                  <p className="text-meta">Deseja encerrar a publicação e impedir novas candidaturas?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setClosingJob("kept")} disabled={closingJob === "busy"}>
                      Manter publicada
                    </Button>
                    <Button size="sm" variant="primary" loading={closingJob === "busy"} onClick={closeJob}>
                      Encerrar vaga
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {successData?.formUrl && (
            <>
              <div>
                <p className="mb-1 text-[13px] font-medium text-wg-ink-secondary">Link do formulário digital</p>
                <div className="flex items-center gap-2 rounded-control border border-wg-border-light bg-wg-bg px-3 py-2">
                  <span className="flex-1 truncate font-mono text-[12px] text-wg-green-dark">{successData.formUrl}</span>
                  <button
                    type="button"
                    onClick={() => copy("url", successData.formUrl)}
                    className="shrink-0 rounded p-0.5 text-wg-green-dark hover:bg-white"
                    aria-label="Copiar link"
                  >
                    {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {successData.whatsappMessage && (
                <div>
                  <p className="mb-1 text-[13px] font-medium text-wg-ink-secondary">Mensagem para WhatsApp</p>
                  <div className="relative rounded-control border border-wg-border-light bg-wg-bg">
                    <textarea
                      readOnly
                      rows={5}
                      value={successData.whatsappMessage}
                      aria-label="Mensagem para WhatsApp"
                      className="w-full resize-none bg-transparent px-3 py-2 text-[12px] text-wg-ink-secondary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copy("msg", successData.whatsappMessage)}
                      className="absolute right-2 top-2 rounded p-0.5 text-wg-green-dark hover:bg-white"
                      aria-label="Copiar mensagem"
                    >
                      {copied === "msg" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
