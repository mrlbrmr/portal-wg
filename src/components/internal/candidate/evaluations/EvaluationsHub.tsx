"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronRight, FileText, ListChecks, MoreHorizontal, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { cn, formatDate } from "@/lib/utils";
import type { AiAnalysis } from "@/lib/recruitment/ai-analysis";
import { evaluationGroup, interviewTypeLabel, referenceResultInfo } from "@/lib/recruitment/evaluations/catalog";
import { interviewDoc, reportExcerpt } from "@/lib/recruitment/evaluations/document";
import { AiAnalysisPanel } from "../AiAnalysisPanel";
import { CandidateTests } from "../CandidateTests";
import { ConfirmDialog } from "../DialogShell";
import { Section } from "../Section";
import type { AssessmentItem, CandidateDetail, CurrentUser, Loadable, TestSession } from "../types";
import { RecommendationLabel, ToneLabel } from "./RecommendationLabel";
import { ExternalEvaluationDialog, ReferenceDialog } from "./SimpleEvaluationDialogs";

// Editor (TipTap + Markdown) e leitor só carregam quando usados — o pipeline fica leve.
const InterviewDialog = dynamic(() => import("./InterviewDialog").then((m) => m.InterviewDialog), { ssr: false });
const InterviewReader = dynamic(() => import("./InterviewReader").then((m) => m.InterviewReader), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-[760px] space-y-3" aria-busy="true" aria-label="Carregando parecer">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  ),
});

type DialogState = { type: "interview" | "reference" | "external"; existing: AssessmentItem | null } | null;

interface Props {
  data: CandidateDetail;
  jobTitle?: string;
  assessments: Loadable<AssessmentItem>;
  onAssessmentsChange: (update: (items: AssessmentItem[]) => AssessmentItem[]) => void;
  onRetryAssessments: () => void;
  sessions: Loadable<TestSession>;
  onSessionsChanged: () => void;
  viewer: CurrentUser | null;
  canManage: boolean;
  wide: boolean;
  /** Teste sugerido pela etapa atual (etapa de teste). */
  defaultTemplateId: string | null;
  analysis: AiAnalysis | null;
  analyzing: boolean;
  onAnalyze: () => void;
  /** Aberto pelo "Registrar entrevista" do card do pipeline. */
  autoStartInterview?: boolean;
  onAutoStartHandled?: () => void;
  /** Algo mudou no banco — o pipeline atualiza contagens/indicadores. */
  onChanged: () => void;
}

const byDateDesc = (a: AssessmentItem, b: AssessmentItem) =>
  (b.occurredAt ?? b.createdAt).localeCompare(a.occurredAt ?? a.createdAt) || b.createdAt.localeCompare(a.createdAt);

/**
 * Aba "Avaliações": hub de TUDO que avalia a candidatura, em modo de consulta.
 *   Testes (assessment_sessions, fonte única) · Entrevistas e pareceres · Referências ·
 *   Avaliações externas (quando houver) · Análise de currículo por IA.
 * Formulários só abrem por ação explícita (Registrar entrevista / Enviar teste /
 * Registrar referência). O parecer abre em leitura; editar é outra ação.
 */
export function EvaluationsHub(props: Props) {
  const { data, jobTitle, assessments, onAssessmentsChange, canManage, wide, viewer, autoStartInterview, onAutoStartHandled, onChanged } = props;
  const { notify } = useToast();
  const rootRef = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toDelete, setToDelete] = useState<AssessmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  const groups = useMemo(() => {
    const items = assessments.items ?? [];
    const pick = (g: string) => items.filter((a) => evaluationGroup(a) === g).sort(byDateDesc);
    return { interviews: pick("interview"), references: pick("reference"), external: pick("external") };
  }, [assessments.items]);

  // "Registrar entrevista" vindo do card: abre o editor assim que se sabe quem está logado.
  useEffect(() => {
    if (!autoStartInterview || !canManage || !viewer) return;
    setDialog({ type: "interview", existing: null });
    onAutoStartHandled?.();
  }, [autoStartInterview, canManage, viewer, onAutoStartHandled]);

  const scrollTop = () => rootRef.current?.closest<HTMLElement>('[role="tabpanel"]')?.scrollTo({ top: 0 });
  const openReader = (id: string) => {
    setReading(id);
    scrollTop();
  };

  const onSaved = (item: AssessmentItem, created: boolean) => {
    onAssessmentsChange((items) => (created ? [item, ...items] : items.map((a) => (a.id === item.id ? item : a))));
    setDialog(null);
    if (item.kind === "INTERVIEW") openReader(item.id);
    onChanged();
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/applications/${data.id}/assessments/${toDelete.id}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        notify("error", j.error ?? "Não foi possível excluir.");
        return;
      }
      onAssessmentsChange((items) => items.filter((a) => a.id !== toDelete.id));
      if (reading === toDelete.id) setReading(null);
      notify("success", toDelete.kind === "INTERVIEW" ? "Parecer excluído." : "Registro excluído.");
      setToDelete(null);
      onChanged();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  };

  const readingItem = reading ? groups.interviews.find((a) => a.id === reading) ?? null : null;
  const defaultEvaluator = viewer?.name ?? "";

  const dialogs = (
    <>
      {dialog?.type === "interview" && (
        <InterviewDialog
          applicationId={data.id}
          candidateName={data.fullName}
          jobTitle={jobTitle}
          criteria={data.screeningCriteria}
          defaultEvaluator={defaultEvaluator}
          existing={dialog.existing}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      )}
      {dialog?.type === "reference" && (
        <ReferenceDialog applicationId={data.id} existing={dialog.existing} onClose={() => setDialog(null)} onSaved={onSaved} />
      )}
      {dialog?.type === "external" && (
        <ExternalEvaluationDialog applicationId={data.id} existing={dialog.existing} onClose={() => setDialog(null)} onSaved={onSaved} />
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title={toDelete?.kind === "INTERVIEW" ? "Excluir parecer?" : "Excluir registro?"}
        description={
          toDelete?.kind === "INTERVIEW"
            ? "A entrevista e o parecer saem do histórico desta candidatura. Não é possível desfazer."
            : "O registro sai do histórico desta candidatura. Não é possível desfazer."
        }
        confirmLabel="Excluir"
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void remove()}
      />
    </>
  );

  if (readingItem) {
    return (
      <div ref={rootRef}>
        <InterviewReader
          item={readingItem}
          applicationId={data.id}
          candidateName={data.fullName}
          jobTitle={jobTitle}
          canManage={canManage}
          onBack={() => setReading(null)}
          onEdit={() => setDialog({ type: "interview", existing: readingItem })}
          onDelete={() => setToDelete(readingItem)}
        />
        {dialogs}
      </div>
    );
  }

  const loading = assessments.items === null;
  const loadFailed = assessments.error && (assessments.items?.length ?? 0) === 0;

  const itemMenu = (a: AssessmentItem, type: "reference" | "external") =>
    canManage ? (
      <DropdownMenu
        trigger={<MoreHorizontal aria-hidden />}
        triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
        ariaLabel="Ações do registro"
        portal
        items={[
          { label: "Editar", icon: Pencil, onSelect: () => setDialog({ type, existing: a }) },
          { type: "separator" },
          { label: "Excluir", icon: Trash2, danger: true, onSelect: () => setToDelete(a) },
        ]}
      />
    ) : null;

  const criteria =
    data.screeningCriteria.length > 0 ? (
      <div className="rounded-control bg-wg-bg/70 px-3 py-2">
        <button
          type="button"
          onClick={() => setCriteriaOpen((v) => !v)}
          aria-expanded={criteriaOpen}
          className="flex w-full items-center gap-2 text-left text-[13px] font-medium text-wg-ink"
        >
          <ListChecks className="h-4 w-4 text-wg-ink-muted" aria-hidden />
          Critérios da vaga
          <span className="text-meta font-normal text-wg-ink-muted">
            {data.screeningCriteria.length} {data.screeningCriteria.length === 1 ? "requisito" : "requisitos"}
          </span>
          <ChevronDown className={cn("ml-auto h-4 w-4 text-wg-ink-muted transition-transform", criteriaOpen && "rotate-180")} aria-hidden />
        </button>
        {criteriaOpen && (
          <>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-meta text-wg-ink-secondary">
              {data.screeningCriteria.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] text-wg-ink-muted">Requisitos obrigatórios definidos na vaga — para consulta durante a entrevista.</p>
          </>
        )}
      </div>
    ) : null;

  const tests = (
    <CandidateTests
      applicationId={data.id}
      sessions={props.sessions}
      canManage={canManage}
      defaultTemplateId={props.defaultTemplateId}
      onChanged={props.onSessionsChanged}
    />
  );

  const interviews = (
    <Section
      title="Entrevistas e pareceres"
      meta={groups.interviews.length > 0 ? <span className="text-meta font-normal tabular-nums text-wg-ink-muted">{groups.interviews.length}</span> : null}
      action={
        canManage &&
        groups.interviews.length > 0 && (
          <Button size="sm" variant="tertiary" icon={Plus} onClick={() => setDialog({ type: "interview", existing: null })}>
            Registrar entrevista
          </Button>
        )
      }
    >
      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando entrevistas">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : loadFailed ? (
        <p className="text-body text-danger-fg" role="alert">
          Não foi possível carregar as avaliações.{" "}
          <button type="button" onClick={props.onRetryAssessments} className="font-semibold text-wg-green-dark hover:underline">
            Tentar novamente
          </button>
        </p>
      ) : groups.interviews.length === 0 ? (
        <EmptyState
          compact
          icon={FileText}
          title="Nenhum parecer registrado"
          description="Registre as avaliações realizadas durante o processo seletivo e mantenha todo o histórico da candidatura centralizado."
          action={
            canManage && (
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => setDialog({ type: "interview", existing: null })}>
                Registrar entrevista
              </Button>
            )
          }
        />
      ) : (
        <ul className="-mx-2 divide-y divide-wg-border-lighter">
          {groups.interviews.map((a) => {
            const excerpt = reportExcerpt(interviewDoc(a), 200);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => openReader(a.id)}
                  className="group block w-full rounded-control px-2 py-3 text-left transition-colors hover:bg-wg-bg/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wg-green/50"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0 text-body font-medium text-wg-ink">
                      {a.title?.trim() || interviewTypeLabel(a.interviewType)}
                      {a.occurredAt && <span className="ml-2 font-normal text-wg-ink-muted">{formatDate(a.occurredAt)}</span>}
                    </span>
                    <RecommendationLabel code={a.recommendation} />
                  </span>
                  {excerpt && <span className="mt-1 line-clamp-2 block text-meta text-wg-ink-secondary">“{excerpt}”</span>}
                  <span className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-wg-ink-muted">
                    <span className="truncate">
                      {a.evaluator || a.createdBy || "—"}
                      {a.title?.trim() && a.title.trim() !== interviewTypeLabel(a.interviewType) && ` · ${interviewTypeLabel(a.interviewType)}`}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-wg-green-dark group-hover:underline">
                      Ver parecer
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );

  const references = (
    <Section
      title="Referências profissionais"
      meta={groups.references.length > 0 ? <span className="text-meta font-normal tabular-nums text-wg-ink-muted">{groups.references.length}</span> : null}
      action={
        canManage &&
        groups.references.length > 0 && (
          <Button size="sm" variant="tertiary" icon={Plus} onClick={() => setDialog({ type: "reference", existing: null })}>
            Registrar referência
          </Button>
        )
      }
    >
      {loading ? (
        <Skeleton className="h-9 w-full" />
      ) : groups.references.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-meta text-wg-ink-muted">Nenhuma referência registrada.</p>
          {canManage && (
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setDialog({ type: "reference", existing: null })}>
              Registrar referência
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-wg-border-lighter">
          {groups.references.map((a) => {
            const result = referenceResultInfo(a.referenceResult);
            return (
              <li key={a.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 text-body text-wg-ink">
                      <span className="font-medium">{a.referenceCompany ?? a.title ?? "Referência"}</span>
                      {a.referenceContact && <span className="text-wg-ink-secondary"> · {a.referenceContact}</span>}
                      {a.referenceRelationship && <span className="text-wg-ink-muted"> ({a.referenceRelationship})</span>}
                    </p>
                    {result && <ToneLabel tone={result.tone} label={result.label} />}
                  </div>
                  {a.summary && <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-meta text-wg-ink-secondary">{a.summary}</p>}
                  <p className="mt-1 text-[12px] text-wg-ink-muted">
                    {a.occurredAt ? formatDate(a.occurredAt) : formatDate(a.createdAt)}
                    {a.createdBy && ` · registrado por ${a.createdBy}`}
                  </p>
                </div>
                {itemMenu(a, "reference")}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );

  const external =
    groups.external.length > 0 ? (
      <Section
        title="Avaliações externas"
        meta={<span className="text-meta font-normal tabular-nums text-wg-ink-muted">{groups.external.length}</span>}
        action={
          canManage && (
            <Button size="sm" variant="tertiary" icon={Plus} onClick={() => setDialog({ type: "external", existing: null })}>
              Registrar
            </Button>
          )
        }
      >
        <ul className="divide-y divide-wg-border-lighter">
          {groups.external.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-wg-ink">{a.title || "Avaliação externa"}</p>
                {a.summary && <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-meta text-wg-ink-secondary">{a.summary}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-wg-ink-muted">
                  <span>
                    {a.occurredAt ? formatDate(a.occurredAt) : formatDate(a.createdAt)}
                    {a.evaluator && ` · ${a.evaluator}`}
                    {a.score !== null && ` · nota registrada: ${Math.round(a.score)}/100`}
                  </span>
                  {a.attachmentName && (
                    <a href={`/api/applications/${data.id}/assessments/${a.id}/file`} className="inline-flex items-center gap-1 font-medium text-wg-green-dark hover:underline">
                      <Paperclip className="h-3 w-3" aria-hidden />
                      {a.attachmentName}
                    </a>
                  )}
                </p>
              </div>
              {itemMenu(a, "external")}
            </li>
          ))}
        </ul>
      </Section>
    ) : canManage && !loading ? (
      <p className="pt-5 text-[12px] text-wg-ink-muted">
        Avaliação feita fora do Portal?{" "}
        <button type="button" onClick={() => setDialog({ type: "external", existing: null })} className="font-medium text-wg-green-dark hover:underline">
          Registrar avaliação externa
        </button>
      </p>
    ) : null;

  const ai = (
    <AiAnalysisPanel
      analysis={props.analysis}
      loading={loading}
      jobCriteria={data.screeningCriteria}
      canManage={canManage}
      resumeName={data.resumeName}
      analyzing={props.analyzing}
      onAnalyze={props.onAnalyze}
    />
  );

  return (
    <div ref={rootRef}>
      {wide ? (
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-x-8">
          <div>
            {tests}
            {interviews}
            {references}
            {external}
          </div>
          <div className="border-l border-wg-border-lighter pl-8">
            {criteria}
            <div className={cn(criteria && "pt-2")}>{ai}</div>
          </div>
        </div>
      ) : (
        <div>
          {criteria && <div className="mb-4">{criteria}</div>}
          {tests}
          {interviews}
          {references}
          {external}
          <div className="mt-5 border-t border-wg-border-lighter pt-1">{ai}</div>
        </div>
      )}
      {dialogs}
    </div>
  );
}
