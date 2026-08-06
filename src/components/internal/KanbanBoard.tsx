"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useRef } from "react";
import { Brain, Calendar, Check, ClipboardCheck, Code2, Download, FlaskConical, Loader2, Mail, Phone, Trash2 } from "lucide-react";
import { formatDate, normalizeText } from "@/lib/utils";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import { useToast } from "@/components/ui/ToastProvider";
import { InterviewModal } from "@/components/internal/InterviewModal";
import {
  KanbanBoardShell,
  type KanbanColumnDef,
} from "@/components/internal/KanbanBoardShell";
import { CandidateDrawer } from "@/components/internal/CandidateDrawer";
import { AdmissionLinkModal, type AdmissionMeta } from "@/components/internal/AdmissionLinkModal";

export interface KanbanApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  resumeName: string | null;
  stageId: string;
  source: string;
  assessmentCount: number;
  createdAt: string; // ISO
  /** Outcome da sessão de teste mais recente (só preenchido quando a etapa é TEST). */
  testOutcome?: "PASS" | "FAIL" | "PENDING_REVIEW" | "PENDING" | null;
  /** Score de compatibilidade por IA (0-100). undefined = não analisado; number = score disponível. */
  aiScore?: number;
}

export interface KanbanStage {
  id: string;
  name: string;
  color: string;
  kind?: string;
  templateId?: string | null;
  templateName?: string | null;
  templateKind?: string | null;
}

interface Props {
  applications: KanbanApplication[];
  stages: KanbanStage[];
  canManage: boolean;
  jobId: string;
  jobTitle?: string;
  jobLocation?: string;
  admissionMeta?: AdmissionMeta | null;
}

export function KanbanBoard({ applications, stages, canManage, jobId, jobTitle, jobLocation, admissionMeta }: Props) {
  const router = useRouter();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingAdmission, setPendingAdmission] = useState<{ candidateId: string; toStageId: string } | null>(null);
  const { notify } = useToast()
  const [aiScoreOverrides, setAiScoreOverrides] = useState<Map<string, number>>(new Map())
  const [sendingTestFor, setSendingTestFor] = useState<string | null>(null)
  const [copiedTestFor, setCopiedTestFor] = useState<string | null>(null)
  const [interviewTarget, setInterviewTarget] = useState<{ applicationId: string; candidateName: string } | null>(null)
  const analyzedRef = useRef(new Set<string>())

  const stageMap = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages])

  // Analisa candidatos com PDF sem score IA ainda — dispara uma vez no mount, fire-and-forget
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!canManage) return
    const toAnalyze = applications.filter(
      (a) =>
        a.resumeName?.toLowerCase().endsWith('.pdf') &&
        a.aiScore === undefined &&
        !analyzedRef.current.has(a.id),
    )
    if (toAnalyze.length === 0) return
    toAnalyze.forEach((a) => analyzedRef.current.add(a.id))
    let active = true
    void (async () => {
      for (const app of toAnalyze.slice(0, 20)) {
        if (!active) break
        try {
          const res = await fetch(`/api/applications/${app.id}/analyze`, {
            method: 'POST',
            credentials: 'same-origin',
          })
          if (res.ok) {
            const { score } = (await res.json()) as { score?: number }
            if (active && typeof score === 'number') {
              setAiScoreOverrides((prev) => new Map(prev).set(app.id, score))
            }
          }
        } catch { /* background task — ignore */ }
        if (active) await new Promise((r) => setTimeout(r, 800))
      }
    })()
    return () => { active = false }
  }, []) // intencional: roda uma vez no mount para candidatos sem score

  async function handleSendTest(applicationId: string, templateId: string) {
    setSendingTestFor(applicationId)
    try {
      const res = await fetch('/api/assessment-sessions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, templateId }),
      })
      const data = (await res.json()) as { error?: string; url?: string; token?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar sessão')
      const url = data.url ?? `${window.location.origin}/avaliacao/${data.token}`
      navigator.clipboard?.writeText(url).catch(() => {})
      setCopiedTestFor(applicationId)
      setTimeout(() => setCopiedTestFor((prev) => (prev === applicationId ? null : prev)), 3000)
      notify('success', 'Link de teste copiado! Envie ao candidato.')
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Erro ao enviar teste.')
    } finally {
      setSendingTestFor(null)
    }
  }

  const columns: KanbanColumnDef[] = stages.map((s) => ({
    key: s.id,
    label: s.name,
    dotColor: s.color,
    kind: s.kind,
    subtitle: s.kind === "TEST" && s.templateName ? s.templateName : undefined,
  }));

  function handleBeforeMove(id: string, toStageId: string): boolean {
    if (admissionMeta && stages.find((s) => s.id === toStageId)?.kind === "ADMISSION") {
      setPendingAdmission({ candidateId: id, toStageId });
      return false;
    }
    return true;
  }

  async function handleAdmissionSuccess(_admissionId: string) {
    if (!pendingAdmission) return;
    const { candidateId, toStageId } = pendingAdmission;
    setPendingAdmission(null);
    await fetch(`/api/applications/${candidateId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: toStageId }),
    });
    router.refresh();
  }

  const pendingCandidate = pendingAdmission
    ? applications.find((a) => a.id === pendingAdmission.candidateId) ?? null
    : null;

  return (
    <>
    <KanbanBoardShell<KanbanApplication>
      initialItems={applications}
      columns={columns}
      canManage={canManage}
      cardClassName="group"
      filterFn={(a, q) => {
        const norm = normalizeText(q);
        return (
          normalizeText(a.fullName).includes(norm) ||
          normalizeText(a.email).includes(norm)
        );
      }}
      searchPlaceholder="Pesquisar candidato..."
      getId={(a) => a.id}
      getColumn={(a) => a.stageId}
      applyColumn={(a, stageId) => ({ ...a, stageId })}
      onMove={(id, stageId) =>
        fetch(`/api/applications/${id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId }),
        })
      }
      onBeforeMove={handleBeforeMove}
      moveSuccess={(a, label) => `${a.fullName} movido para ${label}.`}
      moveError="Erro ao mover candidatura."
      emptyLabel="Nenhuma candidatura"
      onDelete={(id) =>
        fetch(`/api/applications/${id}`, {
          method: "DELETE",
          credentials: "same-origin",
        })
      }
      deleteSuccess={(a) => `Candidatura de ${a.fullName} excluída.`}
      deleteError="Erro ao excluir candidatura."
      confirmDelete={(a) => ({
        title: "Excluir candidatura?",
        message: `A candidatura de "${a.fullName}" e o currículo serão removidos permanentemente (LGPD). Esta ação não pode ser desfeita.`,
        confirmLabel: "Sim, excluir",
      })}
      renderCard={(a, api) => (
        <>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setDetailId(a.id)}
              className="block max-w-full truncate text-left text-[13.5px] font-bold text-[#1A2213] transition-colors hover:text-[#4F6930]"
              title="Abrir ficha do candidato"
            >
              {a.fullName}
            </button>
            <div className="mt-0.5 flex items-center gap-1.5">
              <p className="text-[11.5px] text-[#8A9B7A]">{formatDate(a.createdAt)}</p>
              {a.source && a.source !== "PORTAL" && (
                <span className="rounded-md bg-[#E4F3DA] text-[#2F5D1E] text-[10px] font-bold px-1.5 py-0.5">
                  {APPLICATION_SOURCE_LABELS[a.source] ?? a.source}
                </span>
              )}
              {a.assessmentCount > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-wg-green/15 px-1.5 py-0.5 text-[10px] font-medium text-wg-green-dark"
                  title={`${a.assessmentCount} avaliação(ões)`}
                >
                  <ClipboardCheck className="h-2.5 w-2.5" />
                  {a.assessmentCount}
                </span>
              )}
              {a.testOutcome !== undefined && a.testOutcome !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    a.testOutcome === "PASS"
                      ? "bg-wg-green/15 text-wg-green-dark"
                      : a.testOutcome === "FAIL"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                  title="Resultado do teste online"
                >
                  <FlaskConical className="h-2.5 w-2.5" />
                  {a.testOutcome === "PASS" ? "Aprovado" : a.testOutcome === "FAIL" ? "Reprovado" : "Revisão"}
                </span>
              )}
              {a.testOutcome === null && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600"
                  title="Teste pendente de resposta"
                >
                  <FlaskConical className="h-2.5 w-2.5" />
                  Teste pendente
                </span>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-1">
            <a
              href={`mailto:${a.email}`}
              className="flex items-center gap-1.5 text-[11.5px] text-[#55614A] hover:text-[#1A2213] transition-colors truncate"
            >
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{a.email}</span>
            </a>
            <a
              href={`tel:${a.phone.replace(/\D/g, "")}`}
              className="flex items-center gap-1.5 text-[11.5px] text-[#55614A] hover:text-[#1A2213] transition-colors"
            >
              <Phone className="w-3 h-3 shrink-0" />
              {a.phone}
            </a>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2">
            {a.resumeName ? (
              <a
                href={`/api/applications/${a.id}/resume`}
                className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#4F6930] hover:opacity-80 transition-opacity"
              >
                <Download className="w-3 h-3" />
                Currículo
              </a>
            ) : (
              <span className="text-[11.5px] text-[#8A9B7A]">Sem currículo</span>
            )}
            {canManage && (
              <button
                onClick={() => api.requestDelete(a.id)}
                title="Excluir candidatura"
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Barra de compatibilidade por IA */}
          {(() => {
            const score = aiScoreOverrides.get(a.id) ?? a.aiScore
            if (score === undefined) return null
            return (
              <div className="mt-2.5 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#8A9B7A]">Compatibilidade IA</span>
                  <span className={`text-[10px] font-bold ${score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                    {score}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            )
          })()}

          {/* Botão de envio de teste (etapas TEST) */}
          {(() => {
            const stage = stageMap.get(a.stageId)
            const templateId = stage?.templateId
            if (stage?.kind !== 'TEST' || !templateId || !canManage) return null
            const busy = sendingTestFor === a.id
            const copied = copiedTestFor === a.id
            return (
              <button
                type="button"
                onClick={() => handleSendTest(a.id, templateId)}
                disabled={busy}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1.5 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> :
                 copied ? <Check className="h-3 w-3 text-green-600" /> :
                 stage.templateKind === 'PERSONALITY_BIG5' ? <Brain className="h-3 w-3" /> :
                 stage.templateKind === 'TECHNICAL' ? <Code2 className="h-3 w-3" /> :
                 <FlaskConical className="h-3 w-3" />}
                {copied ? 'Link copiado!' : busy ? 'Criando…' :
                 stage.templateName ? `Enviar ${stage.templateName}` : 'Enviar Teste'}
              </button>
            )
          })()}

          {/* Botão de entrevista (etapas com nome contendo "entrevista") */}
          {(() => {
            const stage = stageMap.get(a.stageId)
            if (!stage || !/entrevista/i.test(stage.name) || !canManage) return null
            return (
              <button
                type="button"
                onClick={() => setInterviewTarget({ applicationId: a.id, candidateName: a.fullName })}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Calendar className="h-3 w-3" />
                Registrar entrevista
              </button>
            )
          })()}
        </>
      )}
    />

    <CandidateDrawer
      applicationId={detailId}
      canManage={canManage}
      stages={stages}
      jobTitle={jobTitle}
      jobLocation={jobLocation}
      onClose={() => setDetailId(null)}
    />

    <AdmissionLinkModal
      open={pendingAdmission !== null}
      candidate={pendingCandidate ? {
        id: pendingCandidate.id,
        fullName: pendingCandidate.fullName,
        email: pendingCandidate.email,
        phone: pendingCandidate.phone,
        jobId,
      } : null}
      meta={admissionMeta ?? null}
      onClose={() => setPendingAdmission(null)}
      onSuccess={handleAdmissionSuccess}
    />

    {interviewTarget && (
      <InterviewModal
        applicationId={interviewTarget.applicationId}
        candidateName={interviewTarget.candidateName}
        onClose={() => setInterviewTarget(null)}
        onSuccess={() => router.refresh()}
      />
    )}
    </>
  );
}
