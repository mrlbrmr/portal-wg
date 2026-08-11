"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useRef } from "react";
import { ArrowLeftRight, Brain, Calendar, Check, Code2, ExternalLink, FlaskConical, LayoutGrid, List, Loader2, Trash2, Users } from "lucide-react";
import { normalizeText } from "@/lib/utils";
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
  /** Status da extração de perfil do CV por IA. 'FAILED'/'MANUAL_REVIEW' exibem badge de alerta para o RH. */
  cvExtractionStatus?: string;
  /** true se o candidato já concluiu alguma sessão de Big Five (independente da etapa atual). */
  bigFiveDone?: boolean;
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

  const topControls = (
    <div className="flex items-center gap-2">
      {/* Contador total — pílula neutra */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500 tabular-nums">
        <Users className="w-3 h-3" />
        {applications.length}
      </span>

      {/* Toggle Lista / Kanban — container pill com divisor */}
      <div className="flex rounded-full border border-[#DCE8CC] overflow-hidden bg-white">
        <button
          type="button"
          className="px-2.5 py-1.5 text-gray-400 hover:text-[#4F6930] hover:bg-[#F4F8EE] transition-colors"
          title="Visualização em lista"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <div className="w-px bg-[#DCE8CC] self-stretch" />
        <button
          type="button"
          className="px-2.5 py-1.5 bg-[#C6E09A] text-[#2E5018] transition-colors"
          title="Visualização em Kanban (ativo)"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Botão Comparar — pílula outline */}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#DCE8CC] text-[11px] font-medium text-[#55614A] hover:bg-[#F4F8EE] hover:border-[#B8D48A] transition-colors"
      >
        <ArrowLeftRight className="w-3 h-3" />
        Comparar
      </button>
    </div>
  );

  return (
    <>
    <KanbanBoardShell<KanbanApplication>
      initialItems={applications}
      columns={columns}
      canManage={canManage}
      cardClassName="group"
      topControls={topControls}
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
      renderCard={(a, api) => {
        const score = aiScoreOverrides.get(a.id) ?? a.aiScore;
        const stage = stageMap.get(a.stageId);
        const isBigFiveDone = a.bigFiveDone === true;
        return (
        <>
          {/* Linha 1: Nome + Match% + Abrir perfil */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setDetailId(a.id)}
              className="flex-1 min-w-0 truncate text-left text-[13px] font-semibold text-[#1A2213] hover:text-[#4F6930] transition-colors"
              title="Abrir ficha do candidato"
            >
              {a.fullName}
            </button>
            {score !== undefined && (
              <span
                className={`shrink-0 text-[10.5px] font-bold whitespace-nowrap tabular-nums ${
                  score >= 80 ? "text-emerald-600"
                  : score >= 60 ? "text-amber-500"
                  : "text-gray-400"
                }`}
                title={`Compatibilidade IA: ${score}%`}
              >
                {score}%
              </span>
            )}
            <button
              type="button"
              onClick={() => setDetailId(a.id)}
              title="Ver perfil"
              className="shrink-0 text-gray-300 hover:text-[#4F6930] transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Barra de progresso proporcional ao match% */}
          {score !== undefined && (
            <div className="mt-1.5 h-[3px] rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  score >= 80 ? "bg-emerald-500"
                  : score >= 60 ? "bg-amber-400"
                  : "bg-red-400"
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          )}

          {/* Linha 2 (condicional): Big Five concluído */}
          {isBigFiveDone && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Brain className="w-3.5 h-3.5 shrink-0" />
              Big Five ok
            </span>
          )}

          {/* Linha 3: Botão de ação da etapa (TEST) */}
          {stage?.kind === 'TEST' && stage.templateId && canManage && (() => {
            const busy = sendingTestFor === a.id;
            const copied = copiedTestFor === a.id;
            return (
              <button
                type="button"
                onClick={() => handleSendTest(a.id, stage.templateId!)}
                disabled={busy}
                className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] font-medium text-[#4F6930] hover:bg-[#EEF4E3] hover:border-[#DCE8CC] disabled:opacity-50 transition-colors"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> :
                 copied ? <Check className="h-3 w-3 text-emerald-600" /> :
                 stage.templateKind === 'PERSONALITY_BIG5' ? <Brain className="h-3 w-3" /> :
                 stage.templateKind === 'TECHNICAL' ? <Code2 className="h-3 w-3" /> :
                 <FlaskConical className="h-3 w-3" />}
                {copied ? 'Link copiado!' : busy ? 'Criando…' :
                 stage.templateName ? `Enviar ${stage.templateName}` : 'Enviar Teste'}
              </button>
            );
          })()}

          {/* Linha 3: Botão de ação da etapa (Entrevista) */}
          {stage && /entrevista/i.test(stage.name) && canManage && (
            <button
              type="button"
              onClick={() => setInterviewTarget({ applicationId: a.id, candidateName: a.fullName })}
              className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] font-medium text-[#4F6930] hover:bg-[#EEF4E3] hover:border-[#DCE8CC] transition-colors"
            >
              <Calendar className="h-3 w-3" />
              Registrar entrevista
            </button>
          )}

          {/* Excluir — visível só no hover */}
          {canManage && (
            <button
              onClick={() => api.requestDelete(a.id)}
              title="Excluir candidatura"
              className="absolute top-1.5 right-1.5 p-0.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </>
        );
      }}
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
