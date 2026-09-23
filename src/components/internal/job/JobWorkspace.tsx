"use client";

// Página de gestão da VAGA (processo seletivo) — /vagas/[id]/editar?tab=…
//
//   Solicitação (REQ) ──► Vaga (VAG) ──► Posições #01..#N ──► contratados
//
// Os campos editáveis vivem num único rascunho controlado, distribuído entre as abas
// "Visão geral" e "Descrição" (trocar de aba não perde o que foi digitado). Salvar envia
// um PATCH; se a alteração mexe no escopo aprovado da solicitação, o RH confirma antes e
// pode registrar o motivo. Posições têm ações próprias (nunca um número editável solto).

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Copy, ExternalLink, Eye, FileText, MoreHorizontal, Save, Users } from "lucide-react";
import type { Job } from "@/types/domain";
import { Panel } from "@/components/ui/Panel";
import { Button, buttonVariants } from "@/components/ui/Button";
import { StatusBadge, type Tone } from "@/components/ui/StatusBadge";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { cn, isPublicJobStatus, MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import { JOB_LIFECYCLE_META, JOB_PROCESS_STATUS_LABELS, jobLifecycle } from "@/lib/recruitment/job-presentation";
import { FILL_STATE_META, shouldOfferClosing, summarizePositions, type JobPosition } from "@/lib/jobs/positions";
import {
  approvedFields,
  approvedHint,
  scopeDivergences,
  scopeFieldsBeingChanged,
  SCOPE_FIELD_LABELS,
  type ApprovedScope,
  type ScopeCurrent,
} from "@/lib/jobs/approved-scope";
import { buildJobHistory, type JobEventRow, type StatusHistoryRow } from "@/lib/jobs/history";
import { salaryColumns } from "@/lib/jobs/salary";
import { markdownToHtml } from "@/lib/jobs/markdown";
import { closeFilledJobAction } from "@/lib/jobs/position-actions";
import { JOB_TABS, type JobTab } from "@/lib/jobs/tabs";
import { DistributionPanel, type PublicationView } from "@/components/internal/DistributionPanel";
import {
  Field,
  MarkdownEditor,
  OpportunityFields,
  SalaryFields,
  StatusSelect,
  draftToPayload,
  inputClass,
  jobToDraft,
  markdownPreviewClass,
  salaryValue,
  validateDraft,
  type JobDraft,
} from "./JobFields";
import { JobPositionsCard, type HireCandidate } from "./JobPositionsCard";
import {
  AllFilledNotice,
  DistributionSummary,
  JobHistoryPanel,
  JobOriginCard,
  JobSummaryPanel,
  PipelineOverview,
  type OriginRequest,
  type PipelineData,
} from "./JobPanels";


export interface JobWorkspaceData {
  job: Job;
  positions: JobPosition[];
  events: JobEventRow[];
  statusHistory: StatusHistoryRow[];
  publications: PublicationView[];
  origin: OriginRequest | null;
  pipeline: PipelineData;
  hireCandidates: HireCandidate[];
  announcementText: string;
  jobUrl: string;
}

/**
 * Corpo do PATCH. A descrição (e a limpeza dos campos de texto legados) só vai quando o
 * conteúdo mudou: reconverter Markdown ⇄ HTML de uma vaga antiga sem necessidade poderia
 * alterar o texto publicado e gerar um falso "Descrição atualizada" no histórico.
 */
function payloadForSave(draft: JobDraft, saved: JobDraft, reason: string | null) {
  const body: Record<string, unknown> = { ...draftToPayload(draft), changeReason: reason };
  if (draft.content === saved.content) {
    for (const k of ["description", "responsibilities", "requiredRequirements", "desiredRequirements", "benefits"]) {
      delete body[k];
    }
  }
  return body;
}

function scopeCurrentFromDraft(d: JobDraft, openings: number): ScopeCurrent {
  return {
    title: d.title,
    department: d.department,
    company: d.company,
    openings,
    contractType: d.contractType,
    modality: d.modality,
    openingReason: d.openingReason || null,
    hiringManager: d.hiringManager,
    salary: d.salaryMode === "DEFINED" ? salaryValue(d) : null,
  };
}

const DISMISS_KEY = (jobId: string) => `vaga:${jobId}:manter-publicada`;

export function JobWorkspace({ data, initialTab }: { data: JobWorkspaceData; initialTab: JobTab }) {
  const { job, positions, events, statusHistory, publications, origin, pipeline, hireCandidates } = data;
  const router = useRouter();
  const { notify } = useToast();
  const tabsId = useId();

  const [tab, setTabState] = useState<JobTab>(initialTab);
  const [draft, setDraft] = useState<JobDraft>(() => jobToDraft(job));
  const [saved, setSaved] = useState<JobDraft>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [candidatePreview, setCandidatePreview] = useState(false);
  const [scopeConfirm, setScopeConfirm] = useState<string[] | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [allFilledPrompt, setAllFilledPrompt] = useState(false);
  const [keepPublished, setKeepPublished] = useState(false);
  const [closing, setClosing] = useState(false);
  const tabRefs = useRef(new Map<JobTab, HTMLButtonElement>());
  // Cabeçalho compacto depois de rolar: ações e abas continuam à mão sem ocupar a tela.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const patch = useCallback((p: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...p })), []);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const scope = (job.approvedScope ?? null) as ApprovedScope | null;
  const summary = useMemo(() => summarizePositions(positions), [positions]);
  const isPublic = isPublicJobStatus(job.status);
  const lifecycle = JOB_LIFECYCLE_META[jobLifecycle(job.status)];
  const statusLabel = JOB_PROCESS_STATUS_LABELS[job.status] ?? job.status;
  const approved = useMemo(() => approvedFields(scope) as Set<string>, [scope]);
  const history = useMemo(
    () => buildJobHistory({ createdAt: String(job.createdAt), statusHistory, events }),
    [job.createdAt, statusHistory, events]
  );

  // Divergências já gravadas (card Origem) × dicas ao vivo no formulário (rascunho).
  const savedScope = useMemo(() => scopeCurrentFromDraft(saved, summary.total), [saved, summary.total]);
  const divergences = useMemo(() => scopeDivergences(scope, savedScope), [scope, savedScope]);
  const liveScope = scopeCurrentFromDraft(draft, summary.total);
  const hints: Partial<Record<string, string | null>> = {
    title: approvedHint(scope, "title", liveScope.title),
    department: approvedHint(scope, "department", liveScope.department),
    company: approvedHint(scope, "company", liveScope.company),
    contractType: approvedHint(scope, "contractType", liveScope.contractType),
    modality: approvedHint(scope, "modality", liveScope.modality),
    openingReason: approvedHint(scope, "openingReason", liveScope.openingReason),
    hiringManager: approvedHint(scope, "hiringManager", liveScope.hiringManager),
  };

  // "Manter publicada" é lembrado por navegador (conveniência; não é regra de negócio).
  useEffect(() => {
    try {
      setKeepPublished(window.localStorage.getItem(DISMISS_KEY(job.id)) === "1");
    } catch {
      /* armazenamento indisponível */
    }
  }, [job.id]);

  const setTab = useCallback((next: JobTab) => {
    setTabState(next);
    const url = new URL(window.location.href);
    if (next === "visao") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  // Aviso ao sair com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function submit(reason: string | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadForSave(draft, saved, reason)),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string | { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
        };
        const e = body.error;
        const message =
          typeof e === "string"
            ? e
            : e?.fieldErrors && Object.keys(e.fieldErrors).length
              ? Object.values(e.fieldErrors).flat().join(", ")
              : e?.formErrors?.join(", ") || `Erro ${res.status} ao salvar a vaga.`;
        setError(message);
        notify("error", message);
        return;
      }
      setSaved(draft);
      setScopeConfirm(null);
      setChangeReason("");
      notify("success", "Alterações salvas.");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const save = useCallback(() => {
    if (saving) return;
    const invalid = validateDraft(draft);
    if (invalid) {
      setError(invalid);
      notify("error", invalid);
      if (invalid.includes("Conteúdo")) setTab("descricao");
      else setTab("visao");
      return;
    }
    const changing = scopeFieldsBeingChanged(scope, scopeCurrentFromDraft(saved, summary.total), scopeCurrentFromDraft(draft, summary.total));
    if (changing.length > 0) {
      setScopeConfirm(changing.map((f) => SCOPE_FIELD_LABELS[f]));
      return;
    }
    void submit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saved, saving, scope, summary.total]);

  // Ctrl/Cmd + S salva.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

  async function closeJob() {
    setClosing(true);
    const res = await closeFilledJobAction(job.id);
    setClosing(false);
    if (!res.ok) {
      notify("error", res.error);
      return;
    }
    setAllFilledPrompt(false);
    // O status salvo mudou: alinha o rascunho para não parecer alteração pendente.
    setDraft((d) => ({ ...d, status: "FILLED" }));
    setSaved((s) => ({ ...s, status: "FILLED" }));
    notify("success", "Vaga encerrada. Novas candidaturas foram bloqueadas.");
    router.refresh();
  }

  function keepJobPublished() {
    setAllFilledPrompt(false);
    setKeepPublished(true);
    try {
      window.localStorage.setItem(DISMISS_KEY(job.id), "1");
    } catch {
      /* ignore */
    }
  }

  const publicUrl = `/vagas/${job.slug ?? job.id}`;
  const menu: DropdownMenuItem[] = [
    { label: "Ver candidatos (pipeline)", icon: Users, href: `/vagas/${job.id}/candidatos` },
    ...(origin ? [{ label: `Ver solicitação ${origin.code ?? ""}`.trim(), icon: FileText, href: `/solicitacoes/${origin.id}` }] : []),
    {
      label: "Copiar link público",
      icon: Copy,
      onSelect: () => {
        navigator.clipboard
          ?.writeText(data.jobUrl)
          .then(() => notify("success", "Link copiado."))
          .catch(() => notify("error", "Não foi possível copiar."));
      },
    },
  ];

  const location = job.isTalentPool ? "Banco de talentos" : job.city ? `${job.city}/${job.state}` : "Local não definido";
  const offerClosing = shouldOfferClosing(summary, isPublic) && !keepPublished;
  const publicSalary = salaryColumns({
    mode: draft.salaryMode,
    salary: salaryValue(draft),
    salaryPublic: draft.salaryPublic,
    legacyText: draft.salaryLegacyText,
  }).salaryRange;

  return (
    <div className="relative pb-10">
      {/* Sentinela: passou dela (≈ altura do cabeçalho), o cabeçalho compacta. */}
      <div ref={sentinelRef} aria-hidden className="pointer-events-none absolute left-0 top-44 h-px w-px" />
      {/* ── Cabeçalho fixo ── */}
      <header className="sticky top-11 z-20 -mx-4 -mt-4 border-b border-wg-border-lighter bg-wg-bg/95 px-4 pt-4 backdrop-blur supports-[backdrop-filter]:bg-wg-bg/85 md:top-0 md:-mx-8 md:-mt-8 md:px-8 md:pt-6">
        <Link
          href="/vagas/gerenciar"
          className={cn(
            "-ml-1 mb-2 inline-flex items-center gap-1 rounded-control px-1 py-0.5 text-meta font-medium text-wg-ink-muted transition-colors hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60",
            compact && "hidden"
          )}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Vagas
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1
                className={cn(
                  "min-w-0 font-sora font-semibold tracking-tight text-wg-ink",
                  compact ? "truncate text-lg" : "text-xl md:text-page-title"
                )}
              >
                {job.title}
              </h1>
              <StatusBadge tone={lifecycle.tone} hint={lifecycle.hint} size="md">
                {statusLabel}
              </StatusBadge>
              {!job.isTalentPool && (summary.state === "PARTIAL" || summary.state === "ALL_FILLED") && (
                <StatusBadge tone={FILL_STATE_META[summary.state].tone} size="md">
                  {FILL_STATE_META[summary.state].label}
                </StatusBadge>
              )}
            </div>
            <p className={cn("mt-1 text-meta text-wg-ink-muted", compact && "hidden")}>
              {[job.code, job.department, location].filter(Boolean).join(" · ")}
            </p>
            {origin && (
              <p className={cn("mt-0.5 text-meta text-wg-ink-muted", compact && "hidden")}>
                Originada da{" "}
                <Link href={`/solicitacoes/${origin.id}`} className="font-semibold text-wg-green-dark hover:underline">
                  {origin.code ?? "solicitação"}
                </Link>
                {origin.requesterName && (
                  <>
                    {" "}
                    · Solicitante: <span className="text-wg-ink-secondary">{origin.requesterName}</span>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {dirty && <span className="hidden text-meta font-medium text-warning-fg sm:inline">Alterações não salvas</span>}
            {isPublic && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
                <ExternalLink aria-hidden />
                <span className="hidden sm:inline">Ver página pública</span>
                <span className="sm:hidden">Portal</span>
              </a>
            )}
            <DropdownMenu
              trigger={<MoreHorizontal aria-hidden />}
              ariaLabel="Mais ações da vaga"
              triggerClassName={buttonVariants({ variant: "secondary", size: "icon" })}
              items={menu}
              align="right"
            />
            <Button variant="primary" icon={Save} loading={saving} disabled={!dirty} onClick={save} title="Salvar (Ctrl+S)">
              Salvar alterações
            </Button>
          </div>
        </div>

        {/* Abas */}
        <div
          role="tablist"
          aria-label="Seções da vaga"
          className="-mb-px mt-3 flex gap-1 overflow-x-auto [scrollbar-width:none]"
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const i = JOB_TABS.findIndex((t) => t.id === tab);
            const next = JOB_TABS[(i + (e.key === "ArrowRight" ? 1 : JOB_TABS.length - 1)) % JOB_TABS.length];
            setTab(next.id);
            tabRefs.current.get(next.id)?.focus();
          }}
        >
          {JOB_TABS.map((t) => {
            const selected = t.id === tab;
            const count = t.id === "historico" ? history.length : t.id === "processo" ? pipeline.total : undefined;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(t.id, el);
                }}
                role="tab"
                type="button"
                id={`${tabsId}-${t.id}`}
                aria-selected={selected}
                aria-controls={`${tabsId}-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wg-green/50",
                  selected ? "border-wg-green-dark text-wg-ink" : "border-transparent text-wg-ink-muted hover:text-wg-ink"
                )}
              >
                {t.label}
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] tabular-nums",
                      selected ? "bg-wg-sidebar text-wg-green-dark" : "bg-neutral-bg text-neutral-fg"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {error && (
        <div role="alert" className="mt-4 rounded-control border border-danger-border bg-danger-bg px-4 py-2.5 text-body text-danger-fg">
          {error}
        </div>
      )}

      {/* ── Visão geral ── */}
      <TabPanel id={`${tabsId}-panel-visao`} labelledBy={`${tabsId}-visao`} hidden={tab !== "visao"}>
        <TwoColumns
          main={
            <>
              <Panel title="Dados da oportunidade">
                <OpportunityFields
                  draft={draft}
                  patch={patch}
                  approved={approved}
                  hints={hints}
                  talentPoolDisabledReason={summary.filled > 0 ? "Há posições preenchidas nesta vaga." : null}
                />
              </Panel>

              <Panel title="Remuneração" description="O valor interno e a divulgação no portal são decisões separadas.">
                <SalaryFields draft={draft} patch={patch} approvedLabel={divergences.find((d) => d.field === "salary")?.approved ?? null} />
              </Panel>

              <Panel title="Gestão do processo">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Status do processo seletivo"
                    htmlFor="job-status"
                    required
                    className="sm:col-span-2"
                    hint={
                      draft.status === "FILLED" && summary.open > 0
                        ? `Ainda há ${summary.open} ${summary.open === 1 ? "posição" : "posições"} em aberto — encerrar não as preenche.`
                        : "Onde o processo está. O preenchimento das posições é acompanhado à parte, no card Posições."
                    }
                  >
                    <StatusSelect id="job-status" value={draft.status} onChange={(v) => patch({ status: v })} />
                  </Field>
                  <Field label="Recrutador responsável" htmlFor="job-responsible" hint="Quem conduz a seleção pelo RH.">
                    <input
                      id="job-responsible"
                      value={draft.responsible}
                      onChange={(e) => patch({ responsible: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Gestor solicitante"
                    htmlFor="job-manager"
                    approved={approved.has("hiringManager")}
                    approvedHint={hints.hiringManager}
                    hint={job.isTalentPool ? "Opcional em banco de talentos." : "Quem pediu a vaga e valida os finalistas."}
                  >
                    <input
                      id="job-manager"
                      value={draft.hiringManager}
                      onChange={(e) => patch({ hiringManager: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Inscrições até" htmlFor="job-closing" hint="Após essa data, novas candidaturas serão bloqueadas.">
                    <input
                      id="job-closing"
                      type="date"
                      value={draft.closingDate}
                      onChange={(e) => patch({ closingDate: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Contratação prevista até"
                    htmlFor="job-deadline"
                    hint={draft.isTalentPool ? "Opcional em banco de talentos." : "Meta interna para preenchimento das posições."}
                  >
                    <input
                      id="job-deadline"
                      type="date"
                      value={draft.hiringDeadline}
                      onChange={(e) => patch({ hiringDeadline: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Panel>

              <JobPositionsCard
                jobId={job.id}
                isTalentPool={job.isTalentPool}
                positions={positions}
                events={events}
                hireCandidates={hireCandidates}
                approvedOpenings={scope?.openings ?? null}
                requestCode={origin?.code ?? scope?.requestCode ?? null}
                canManage
                onAllFilled={() => isPublic && setAllFilledPrompt(true)}
              />
            </>
          }
          aside={
            <>
              {offerClosing && <AllFilledNotice busy={closing} onClose={closeJob} onKeep={keepJobPublished} />}
              <JobSummaryPanel
                statusLabel={statusLabel}
                statusTone={lifecycle.tone as Tone}
                isTalentPool={job.isTalentPool}
                positions={summary}
                pipeline={pipeline}
                recruiter={job.responsible}
                manager={job.hiringManager}
                hiringDeadline={job.hiringDeadline ? String(job.hiringDeadline) : null}
                closingDate={job.closingDate ? String(job.closingDate) : null}
              />
              <JobOriginCard origin={origin} divergences={divergences} />
              <DistributionSummary
                isPublic={isPublic}
                linkedinStatus={publications.find((p) => p.channel === "LINKEDIN_PAGE")?.status ?? null}
                onManage={() => setTab("divulgacao")}
              />
            </>
          }
        />
      </TabPanel>

      {/* ── Descrição ── */}
      <TabPanel id={`${tabsId}-panel-descricao`} labelledBy={`${tabsId}-descricao`} hidden={tab !== "descricao"}>
        <TwoColumns
          main={
            <Panel
              title="Conteúdo da vaga"
              description="Texto público exibido na página da vaga e enviado aos canais de divulgação."
              action={
                <Button size="sm" variant="secondary" icon={Eye} onClick={() => setCandidatePreview(true)}>
                  Visualizar como candidato
                </Button>
              }
            >
              <MarkdownEditor value={draft.content} onChange={(v) => patch({ content: v })} mode={editorMode} onModeChange={setEditorMode} />
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                {dirty && <span className="text-meta font-medium text-warning-fg">Alterações não salvas</span>}
                <Button variant="primary" icon={Save} loading={saving} disabled={!dirty} onClick={save}>
                  Salvar
                </Button>
              </div>
            </Panel>
          }
          aside={
            <Panel title="Como aparece no portal" description="Dados exibidos junto com o texto.">
              <dl className="-mt-1 divide-y divide-wg-border-lighter text-body">
                <PublicRow label="Título" value={draft.title || "—"} />
                <PublicRow label="Local" value={draft.isTalentPool ? "Diversas localidades" : draft.city ? `${draft.city}/${draft.state}` : "—"} />
                <PublicRow label="Modalidade" value={MODALITY_LABELS[draft.modality] ?? draft.modality} />
                <PublicRow label="Contratação" value={CONTRACT_TYPE_LABELS[draft.contractType] ?? draft.contractType} />
                <PublicRow label="Horário" value={draft.workSchedule || "—"} />
                <PublicRow label="Salário" value={publicSalary ?? "Não divulgado"} />
                {!draft.isTalentPool && <PublicRow label="Vagas em aberto" value={String(summary.open)} />}
              </dl>
            </Panel>
          }
        />
      </TabPanel>

      {/* ── Processo seletivo ── */}
      <TabPanel id={`${tabsId}-panel-processo`} labelledBy={`${tabsId}-processo`} hidden={tab !== "processo"}>
        <PipelineOverview jobId={job.id} pipeline={pipeline} positions={summary} isTalentPool={job.isTalentPool} />
      </TabPanel>

      {/* ── Divulgação ── */}
      <TabPanel id={`${tabsId}-panel-divulgacao`} labelledBy={`${tabsId}-divulgacao`} hidden={tab !== "divulgacao"}>
        <div className="max-w-4xl">
          <DistributionPanel
            jobId={job.id}
            jobUrl={data.jobUrl}
            isPublic={isPublic}
            publications={publications}
            announcementText={data.announcementText}
          />
        </div>
      </TabPanel>

      {/* ── Histórico ── */}
      <TabPanel id={`${tabsId}-panel-historico`} labelledBy={`${tabsId}-historico`} hidden={tab !== "historico"}>
        <div className="max-w-3xl">
          <JobHistoryPanel items={history} />
        </div>
      </TabPanel>

      {/* ── Confirmação de alteração do escopo aprovado ── */}
      <Dialog
        open={scopeConfirm !== null}
        onClose={() => setScopeConfirm(null)}
        busy={saving}
        title="Alterar dados aprovados na solicitação?"
        description={`Esta vaga foi aprovada na ${origin?.code ?? scope?.requestCode ?? "solicitação de origem"}. A solicitação original não muda, mas a vaga passará a divergir do que foi aprovado.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setScopeConfirm(null)} disabled={saving}>
              Revisar
            </Button>
            <Button variant="primary" loading={saving} onClick={() => submit(changeReason.trim() || null)}>
              Salvar mesmo assim
            </Button>
          </>
        }
      >
        <p className="text-body text-wg-ink">Campos do escopo aprovado que serão alterados:</p>
        <ul className="mt-1.5 list-disc pl-5 text-body text-wg-ink-secondary">
          {scopeConfirm?.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <label htmlFor="scope-reason" className="mb-1 mt-4 block text-[13px] font-medium text-wg-ink-secondary">
          Motivo <span className="font-normal text-wg-ink-muted">(fica no histórico da vaga)</span>
        </label>
        <textarea
          id="scope-reason"
          rows={3}
          value={changeReason}
          onChange={(e) => setChangeReason(e.target.value)}
          placeholder="Ex.: gestor pediu ajuste do título após a aprovação"
          className={cn(inputClass, "h-auto py-2")}
        />
      </Dialog>

      {/* ── Todas as posições preenchidas (logo após a ação) ── */}
      <Dialog
        open={allFilledPrompt}
        onClose={() => setAllFilledPrompt(false)}
        busy={closing}
        title="Todas as posições desta vaga foram preenchidas"
        description="Deseja encerrar a publicação e impedir novas candidaturas? A vaga sai do portal e dos feeds; o histórico e os candidatos continuam disponíveis."
        footer={
          <>
            <Button variant="secondary" onClick={keepJobPublished} disabled={closing}>
              Manter publicada
            </Button>
            <Button variant="primary" loading={closing} onClick={closeJob}>
              Encerrar vaga
            </Button>
          </>
        }
      />

      {/* ── Visualizar como candidato ── */}
      <Dialog open={candidatePreview} onClose={() => setCandidatePreview(false)} size="lg" title="Visualização do candidato">
        <article>
          <h2 className="font-sora text-2xl font-semibold text-wg-ink">{draft.title || "Título da vaga"}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-meta text-wg-ink-secondary">
            <Chip>{draft.isTalentPool ? "Diversas localidades" : draft.city ? `${draft.city} / ${draft.state}` : "Local"}</Chip>
            <Chip>{MODALITY_LABELS[draft.modality] ?? draft.modality}</Chip>
            <Chip>{CONTRACT_TYPE_LABELS[draft.contractType] ?? draft.contractType}</Chip>
            {draft.workSchedule && <Chip>{draft.workSchedule}</Chip>}
            {publicSalary && <Chip>{publicSalary}</Chip>}
          </div>
          <div className={cn("mt-5 border-t border-wg-border-lighter pt-4", markdownPreviewClass)} dangerouslySetInnerHTML={{ __html: markdownToHtml(draft.content) }} />
          {!isPublic && (
            <p className="mt-4 rounded-control bg-wg-bg px-3 py-2 text-meta text-wg-ink-muted">
              Esta vaga não está publicada. O candidato só verá esta página quando o status estiver no portal.
            </p>
          )}
        </article>
      </Dialog>
    </div>
  );
}

function TabPanel({ id, labelledBy, hidden, children }: { id: string; labelledBy: string; hidden: boolean; children: React.ReactNode }) {
  return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} hidden={hidden} className="pt-6 focus-visible:outline-none">
      {children}
    </div>
  );
}

function TwoColumns({ main, aside }: { main: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">{main}</div>
      <aside className="min-w-0 space-y-6">{aside}</aside>
    </div>
  );
}

function PublicRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-meta text-wg-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-wg-ink">{value}</dd>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-wg-border-light bg-white px-2.5 py-1">{children}</span>;
}

