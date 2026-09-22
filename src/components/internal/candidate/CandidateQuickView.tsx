"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import { ASSESSMENT_KIND_LABELS } from "@/lib/assessment-schema";
import type { ApplicationNote } from "@/lib/application-notes";
import { latestAiAnalysis } from "@/lib/recruitment/ai-analysis";
import { isTypingTarget } from "@/lib/recruitment/candidate-navigation";
import { pipelineGroup } from "@/lib/recruitment/candidate-presentation";
import { candidateStageFlow, enteredCurrentStageAt, type FlowStage } from "@/lib/recruitment/candidate-stage-flow";
import { buildCandidateTimeline } from "@/lib/recruitment/candidate-timeline";
import type { PipelineStage } from "@/components/internal/candidates/types";
import { AiAnalysisPanel } from "./AiAnalysisPanel";
import type { CandidateProfilePatch } from "./CandidateEditForm";
import { CandidateHeader, FullProfileAction, type StageActionKind } from "./CandidateHeader";
import type { CandidateQueueNav } from "./CandidateNavigation";
import { CandidateNotes } from "./CandidateNotes";
import { CandidateOverview } from "./CandidateOverview";
import { CandidateStageBar } from "./CandidateStageBar";
import { CandidateTests } from "./CandidateTests";
import { CandidateTimeline } from "./CandidateTimeline";
import { ManualAssessments } from "./ManualAssessments";
import { MoveStageDialog } from "./MoveStageDialog";
import { RejectionDialog, buildRejectionNote } from "./RejectionDialog";
import { useCandidateWorkspace } from "./useCandidateWorkspace";

type Tab = "overview" | "assessments" | "notes" | "history";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Visão geral" },
  { id: "assessments", label: "Avaliações" },
  { id: "notes", label: "Anotações" },
  { id: "history", label: "Histórico" },
];

/** Split view só quando sobra espaço útil para o pipeline à esquerda (~40%). */
const SPLIT_MIN_AVAILABLE = 1040;
const WIDE_PANEL = 960;

interface Layout {
  mode: "split" | "overlay";
  /** Borda esquerda da área de conteúdo (depois da sidebar). */
  left: number;
  /** Largura do painel no split. */
  width: number;
}

interface Props {
  applicationId: string | null;
  canManage: boolean;
  stages: PipelineStage[];
  jobTitle?: string;
  /** Aderência já conhecida pelo pipeline — o header não "pisca" enquanto as avaliações carregam. */
  knownScore?: number;
  nav: CandidateQueueNav;
  onClose: () => void;
  /**
   * Chamado antes de mudar a etapa. Retorne false para interceptar (ex.: o pipeline abre o
   * modal de admissão ao mover para uma etapa de Admissão) — o painel não faz o PATCH.
   */
  onBeforeStageChange?: (applicationId: string, stageId: string) => boolean;
  /** A IA recalculou a aderência — o card do pipeline atualiza sem recarregar. */
  onScoreChange?: (applicationId: string, score: number) => void;
}

/**
 * Quick View do candidato: estação de triagem aberta ao lado do pipeline da vaga.
 * No desktop é um split view (o Kanban continua visível e clicável à esquerda); em telas
 * menores ocupa a tela. Cabeçalho (quem é + ações do painel), abas roláveis e a barra de
 * decisão fixa no rodapé. Regras de etapa: candidate-stage-flow (módulo puro).
 */
export function CandidateQuickView({
  applicationId,
  canManage,
  stages,
  jobTitle,
  knownScore,
  nav,
  onClose,
  onBeforeStageChange,
  onScoreChange,
}: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ws = useCandidateWorkspace(applicationId);
  const { data } = ws;

  const [tab, setTab] = useState<Tab>("overview");
  const [expanded, setExpanded] = useState(false);
  const [layout, setLayout] = useState<Layout>({ mode: "overlay", left: 0, width: 0 });
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pending, setPending] = useState<StageActionKind | null>(null);
  const [dialog, setDialog] = useState<"move" | "reject" | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const open = applicationId !== null;

  // ── Troca de candidato: estado efêmero volta ao padrão (a aba é mantida na triagem) ──
  useEffect(() => {
    setEditing(false);
    setDialog(null);
    setPending(null);
    setAnalyzing(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [applicationId]);

  // Abrir do zero (não navegar J/K) volta para a Visão geral.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setTab("overview");
      setExpanded(false);
    }
    wasOpen.current = open;
  }, [open]);

  // ── Anotações: rascunho não se perde ao trocar de candidato ou fechar ──
  const postNote = useCallback(async (id: string, body: string) => {
    const res = await fetch(`/api/applications/${id}/notes`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const j = (await res.json().catch(() => ({}))) as { note?: ApplicationNote; error?: string };
    if (!res.ok || !j.note) throw new Error(j.error ?? "Não foi possível salvar a anotação.");
    return j.note;
  }, []);

  // O rascunho pertence ao candidato em que foi escrito: ao trocar (J/K) ou fechar, ele é
  // salvo nesse candidato — o id vem do fechamento do efeito, não do render seguinte.
  const draftRef = useRef("");
  draftRef.current = noteDraft;
  const namesRef = useRef(new Map<string, string>());
  if (data) namesRef.current.set(data.id, data.fullName);

  useEffect(() => {
    const id = applicationId;
    return () => {
      const text = draftRef.current;
      if (id && text.trim() && canManage) {
        const name = namesRef.current.get(id);
        postNote(id, text)
          .then(() => notify("success", name ? `Rascunho de anotação salvo em ${name}.` : "Rascunho de anotação salvo."))
          .catch(() => notify("error", "Não foi possível salvar o rascunho da anotação."));
      }
      setNoteDraft("");
    };
  }, [applicationId, canManage, postNote, notify]);

  const createNote = async () => {
    if (!applicationId || !noteDraft.trim()) return;
    setNoteSaving(true);
    try {
      const note = await postNote(applicationId, noteDraft);
      ws.setNotes((s) => ({ items: [note, ...(s.items ?? [])], error: false }));
      setNoteDraft("");
      notify("success", "Anotação salva.");
      router.refresh();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Não foi possível salvar a anotação.");
    } finally {
      setNoteSaving(false);
    }
  };

  // ── Layout: split view no desktop, tela cheia no resto ──
  useLayoutEffect(() => {
    if (!open) return;
    const main = document.querySelector<HTMLElement>("[data-internal-main]");
    const measure = () => {
      const vw = window.innerWidth;
      const left = main ? Math.max(0, Math.round(main.getBoundingClientRect().left)) : 0;
      const available = vw - left;
      const next: Layout =
        vw >= 1024 && available >= SPLIT_MIN_AVAILABLE
          ? { mode: "split", left, width: Math.round(Math.min(1120, Math.max(620, available * 0.6))) }
          : { mode: "overlay", left: 0, width: vw };
      setLayout((prev) => (prev.mode === next.mode && prev.left === next.left && prev.width === next.width ? prev : next));
    };
    measure();
    window.addEventListener("resize", measure);
    const mql = window.matchMedia("(min-width: 1024px)");
    mql.addEventListener("change", measure);
    const ro = main && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (main) ro?.observe(main, { box: "border-box" });
    return () => {
      window.removeEventListener("resize", measure);
      mql.removeEventListener("change", measure);
      ro?.disconnect();
    };
  }, [open]);

  const split = layout.mode === "split";

  // No split, o conteúdo da página abre espaço à direita (globals.css) — o Kanban não fica
  // escondido atrás do painel. No overlay, trava a rolagem do fundo.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    if (split) {
      root.dataset.quickview = expanded ? "expanded" : "split";
      root.style.setProperty("--quickview-width", `${layout.width}px`);
      return () => {
        delete root.dataset.quickview;
        root.style.removeProperty("--quickview-width");
      };
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, split, expanded, layout.width]);

  // Foco: entra no painel ao abrir e volta para quem abriu ao fechar.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      if (previous?.isConnected) previous.focus?.();
    };
  }, [open]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  // ── Teclado: Esc fecha; J/K navegam (nunca enquanto se digita) ──
  const navRef = useRef(nav);
  navRef.current = nav;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (dialog || document.querySelector("[data-dialog-shell]")) return;
      // Arraste por teclado no Kanban em andamento: as teclas são dele.
      if (document.querySelector('[aria-roledescription="sortable"][aria-pressed="true"]')) return;
      const target = e.target as HTMLElement | null;
      if (isTypingTarget(target) || target?.closest?.('[role="menu"], [role="listbox"]')) return;
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "j" && navRef.current.onNext) {
        e.preventDefault();
        navRef.current.onNext();
      } else if (key === "k" && navRef.current.onPrev) {
        e.preventDefault();
        navRef.current.onPrev();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dialog, handleClose]);

  // ── Derivados ──
  const flow = useMemo(
    () =>
      data
        ? candidateStageFlow(
            stages as FlowStage[],
            data.stageId,
            data.stageHistory.map((h) => h.stageId ?? "")
          )
        : null,
    [data, stages]
  );
  const lostStageId = stages.find((s) => s.kind === "LOST")?.id ?? null;
  const enteredStageAt = data ? enteredCurrentStageAt(data.stageHistory, data.stageId) : null;
  const analysis = useMemo(() => (ws.assessments.items ? latestAiAnalysis(ws.assessments.items) : null), [ws.assessments.items]);
  const score = analysis?.score ?? knownScore;
  const isNew = data ? pipelineGroup(stages.find((s) => s.id === data.stageId) as FlowStage | undefined, stages as FlowStage[]) === "NEW" : false;

  const events = useMemo(
    () =>
      data
        ? buildCandidateTimeline({
            createdAt: data.createdAt,
            sourceLabel: APPLICATION_SOURCE_LABELS[data.source] ?? data.source,
            addedBy: data.addedBy,
            stageHistory: data.stageHistory,
            lostStageId,
            assessments: ws.assessments.items ?? [],
            sessions: ws.sessions.items ?? [],
            notes: ws.notes.items ?? [],
            kindLabels: ASSESSMENT_KIND_LABELS,
          })
        : [],
    [data, lostStageId, ws.assessments.items, ws.sessions.items, ws.notes.items]
  );

  if (!applicationId) return null;

  // ── Ações ──
  const changeStage = async (target: FlowStage, kind: StageActionKind, extra?: { notes: string | null }) => {
    if (!data) return false;
    if (onBeforeStageChange && !onBeforeStageChange(data.id, target.id)) return false;
    setPending(kind);
    try {
      const res = await fetch(`/api/applications/${data.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: target.id, ...(extra ?? {}) }),
      });
      if (!res.ok) {
        notify("error", kind === "reject" ? "Não foi possível reprovar a candidatura. Tente novamente." : "Não foi possível mover o candidato. Tente novamente.");
        return false;
      }
      notify(
        "success",
        kind === "reject"
          ? `Candidatura de ${data.fullName} reprovada.`
          : kind === "resume"
          ? `Candidatura reaberta em ${target.name}.`
          : `${data.fullName} movido para ${target.name}.`
      );
      ws.reloadDetail({ silent: true });
      router.refresh();
      return true;
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
      return false;
    } finally {
      setPending(null);
    }
  };

  const reject = async (reason: string, note: string) => {
    if (!flow?.lost || !data) return;
    // Mesmo registro de antes: o motivo vai para as anotações anteriores (applications.notes).
    const block = buildRejectionNote(reason, note);
    const base = (data.notes ?? "").trim();
    const notes = base ? `${base}\n\n${block}` : block;
    if (notes.length > 5000) {
      notify("error", "As anotações anteriores passaram do limite de 5.000 caracteres. Resuma a observação.");
      return;
    }
    const ok = await changeStage(flow.lost, "reject", { notes });
    if (ok) {
      ws.setData((d) => (d ? { ...d, notes } : d));
      setDialog(null);
    }
  };

  const saveLegacyNotes = async (value: string) => {
    if (!data) return false;
    try {
      const res = await fetch(`/api/applications/${data.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value.trim() ? value : null }),
      });
      if (!res.ok) throw new Error();
      ws.setData((d) => (d ? { ...d, notes: value.trim() ? value : null } : d));
      notify("success", "Anotações anteriores atualizadas.");
      return true;
    } catch {
      notify("error", "Não foi possível salvar as anotações.");
      return false;
    }
  };

  const saveProfile = async (patch: CandidateProfilePatch) => {
    if (!data) return;
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/applications/${data.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        notify("error", "Não foi possível salvar os dados. Confira os campos.");
        return;
      }
      ws.setData((d) => (d ? { ...d, ...patch } : d));
      setEditing(false);
      notify("success", "Dados do candidato atualizados.");
      router.refresh();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setSavingProfile(false);
    }
  };

  const replaceResume = async (file: File) => {
    if (!data) return;
    setUploadingResume(true);
    try {
      const form = new FormData();
      form.append("resume", file);
      const res = await fetch(`/api/applications/${data.id}/resume`, { method: "PUT", credentials: "same-origin", body: form });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        notify("error", err.error ?? "Não foi possível enviar o currículo.");
        return;
      }
      const { resumeName } = (await res.json()) as { resumeName: string };
      ws.setData((d) => (d ? { ...d, resumeName } : d));
      notify("success", data.resumeName ? "Currículo substituído." : "Currículo anexado.");
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setUploadingResume(false);
    }
  };

  const runAnalysis = async () => {
    if (!data) return;
    const id = data.id;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/applications/${id}/analyze`, { method: "POST", credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as { error?: string; score?: number };
      if (!res.ok) {
        notify("error", json.error ?? "Não foi possível analisar o currículo.");
        return;
      }
      notify("success", "Análise do currículo concluída.");
      if (typeof json.score === "number") onScoreChange?.(id, json.score);
      ws.reloadAssessments();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setAnalyzing(false);
    }
  };

  const copy = (label: "E-mail" | "Telefone", value: string) => {
    if (!navigator.clipboard) {
      notify("error", "Não foi possível copiar neste navegador.");
      return;
    }
    navigator.clipboard
      .writeText(value)
      .then(() => notify("success", `${label} copiado.`))
      .catch(() => notify("error", "Não foi possível copiar."));
  };

  const selectTab = (t: Tab) => {
    setTab(t);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const startEditing = () => {
    selectTab("overview");
    setEditing(true);
  };

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    selectTab(TABS[next].id);
    document.getElementById(`${titleId}-tab-${TABS[next].id}`)?.focus();
  };

  const notesCount = (ws.notes.items?.length ?? 0) + (data?.notes?.trim() ? 1 : 0);
  const counts: Partial<Record<Tab, number>> = { notes: notesCount, history: events.length };
  const panelWidth = split ? (expanded ? window.innerWidth - layout.left : layout.width) : layout.width;
  const wide = panelWidth >= WIDE_PANEL;
  const extrasLoading = ws.assessments.items === null || ws.sessions.items === null || ws.notes.items === null;

  // ── Conteúdo da aba ──
  let body: React.ReactNode;
  if (ws.error) {
    body = (
      <div className="py-12 text-center" role="alert">
        <p className="text-body text-danger-fg">Não foi possível carregar a ficha do candidato.</p>
        <button type="button" onClick={() => ws.reloadDetail()} className="mt-2 text-meta font-semibold text-wg-green-dark hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  } else if (!data) {
    body = (
      <div className="space-y-5" aria-busy="true" aria-label="Carregando candidato">
        <Skeleton className="h-24 w-full rounded-card" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  } else if (tab === "overview") {
    body = (
      <CandidateOverview
        data={data}
        analysis={analysis}
        analysisLoading={ws.assessments.items === null}
        canManage={canManage}
        analyzing={analyzing}
        onAnalyze={() => void runAnalysis()}
        onOpenEvaluations={() => selectTab("assessments")}
        wide={wide}
        uploadingResume={uploadingResume}
        onReplaceResume={(f) => void replaceResume(f)}
        editing={editing}
        savingProfile={savingProfile}
        onEdit={startEditing}
        onCancelEdit={() => setEditing(false)}
        onSaveProfile={(p) => void saveProfile(p)}
        onInvalid={(m) => notify("error", m)}
        admission={ws.admission}
        onCopy={copy}
      />
    );
  } else if (tab === "assessments") {
    body = (
      <div className={cn(wide && "grid grid-cols-2 gap-x-8")}>
        <AiAnalysisPanel
          analysis={analysis}
          loading={ws.assessments.items === null}
          jobCriteria={data.screeningCriteria}
          canManage={canManage}
          resumeName={data.resumeName}
          analyzing={analyzing}
          onAnalyze={() => void runAnalysis()}
        />
        <div className={cn(wide ? "border-l border-wg-border-lighter pl-8" : "border-t border-wg-border-lighter")}>
          <CandidateTests
            applicationId={data.id}
            sessions={ws.sessions}
            canManage={canManage}
            defaultTemplateId={stages.find((s) => s.id === data.stageId && s.kind === "TEST")?.templateId ?? null}
            onChanged={() => {
              ws.reloadSessions();
              router.refresh();
            }}
          />
          <ManualAssessments
            applicationId={data.id}
            assessments={ws.assessments}
            canManage={canManage}
            onChanged={() => {
              ws.reloadAssessments();
              router.refresh();
            }}
          />
        </div>
      </div>
    );
  } else if (tab === "notes") {
    body = (
      <div className={cn(wide && "max-w-3xl")}>
        <CandidateNotes
          key={data.id}
          applicationId={data.id}
          notes={ws.notes}
          currentUserId={ws.currentUserId}
          canManage={canManage}
          draft={noteDraft}
          onDraftChange={setNoteDraft}
          saving={noteSaving}
          onCreate={() => void createNote()}
          onNotesChange={(update) => ws.setNotes((s) => ({ items: update(s.items ?? []), error: false }))}
          onRetry={() => ws.reloadNotes()}
          legacyNotes={data.notes}
          onSaveLegacy={saveLegacyNotes}
        />
      </div>
    );
  } else {
    body = (
      <div className={cn(wide && "max-w-3xl")}>
        <CandidateTimeline events={events} loadingExtras={extrasLoading} />
      </div>
    );
  }

  const panel = (
    <div
      role="dialog"
      aria-modal={split ? "false" : "true"}
      aria-labelledby={titleId}
      className={cn(
        "fixed bottom-0 right-0 top-0 z-50 flex flex-col bg-white",
        split
          ? "border-l border-wg-border-light shadow-[-12px_0_32px_-18px_rgba(26,34,19,.35)]"
          : "w-full shadow-[-10px_0_34px_rgba(26,34,19,.14)] sm:max-w-[720px]",
        "animate-in slide-in-from-right-8 fade-in-0 duration-200"
      )}
      style={split ? (expanded ? { left: layout.left } : { width: layout.width }) : undefined}
    >
      <CandidateHeader
        data={data}
        jobTitle={jobTitle}
        score={score}
        isNew={isNew}
        flow={flow}
        canManage={canManage}
        pending={pending}
        titleId={titleId}
        closeRef={closeRef}
        nav={nav}
        onClose={handleClose}
        onChangeStage={(stage, kind) => void changeStage(stage, kind)}
        onOpenMove={() => setDialog("move")}
        onOpenReject={() => setDialog("reject")}
        onEdit={startEditing}
        onCopy={copy}
      />

      <div
        role="tablist"
        aria-label="Seções do candidato"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-wg-border-lighter px-3 sm:px-4"
        onKeyDown={onTabKeyDown}
      >
        {TABS.map((t) => {
          const selected = tab === t.id;
          const count = counts[t.id];
          return (
            <button
              key={t.id}
              id={`${titleId}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${titleId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(t.id)}
              className={cn(
                "-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wg-green/50",
                selected ? "border-wg-green-dark text-wg-ink" : "border-transparent text-wg-ink-muted hover:text-wg-ink"
              )}
            >
              {t.label}
              {!!count && data && (
                <span className="rounded-full bg-neutral-bg px-1.5 text-[11px] tabular-nums text-neutral-fg">{count}</span>
              )}
            </button>
          );
        })}
        <div className="ml-auto flex shrink-0 items-center gap-4 pl-3">
          <span className="hidden items-center text-[11.5px] text-wg-ink-muted/80 xl:inline-flex" aria-hidden>
            <kbd className="rounded border border-wg-border-light bg-wg-bg px-1 font-sans">J</kbd>
            <kbd className="ml-0.5 rounded border border-wg-border-light bg-wg-bg px-1 font-sans">K</kbd>
            <span className="ml-1">navegar</span>
          </span>
          <FullProfileAction expanded={split ? expanded : null} onToggleExpand={() => setExpanded((v) => !v)} />
        </div>
      </div>

      <div
        ref={scrollRef}
        id={`${titleId}-panel`}
        role="tabpanel"
        aria-labelledby={`${titleId}-tab-${tab}`}
        tabIndex={-1}
        className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 focus:outline-none sm:px-5"
      >
        <div className={cn(expanded && "mx-auto max-w-[1400px]")}>{body}</div>
      </div>

      <CandidateStageBar
        data={data}
        flow={flow}
        canManage={canManage}
        pending={pending}
        enteredStageAt={enteredStageAt}
        onKeep={nav.onNext}
        onChangeStage={(stage, kind) => void changeStage(stage, kind)}
        onOpenReject={() => setDialog("reject")}
      />
    </div>
  );

  return createPortal(
    <>
      {!split && <div className="fixed inset-0 z-50 bg-[#1A2213]/25 animate-in fade-in-0" onClick={handleClose} aria-hidden />}
      {panel}
      {data && flow && (
        <>
          <MoveStageDialog
            open={dialog === "move"}
            candidateName={data.fullName}
            currentStageName={data.stage?.name ?? null}
            targets={flow.moveTargets}
            busy={pending === "move"}
            onCancel={() => setDialog(null)}
            onConfirm={async (stageId) => {
              const target = flow.moveTargets.find((s) => s.id === stageId);
              if (!target) return;
              const ok = await changeStage(target, "move");
              if (ok) setDialog(null);
            }}
          />
          {flow.lost && (
            <RejectionDialog
              open={dialog === "reject"}
              candidateName={data.fullName}
              targetStageName={flow.lost.name}
              busy={pending === "reject"}
              onCancel={() => setDialog(null)}
              onConfirm={(reason, note) => void reject(reason, note)}
            />
          )}
        </>
      )}
    </>,
    document.body
  );
}
