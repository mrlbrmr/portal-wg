"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { StageBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { cn, formatDate } from "@/lib/utils";
import {
  candidateStageFlow,
  enteredCurrentStageAt,
  type FlowStage,
} from "@/lib/recruitment/candidate-stage-flow";
import { AssessmentsSection } from "@/components/internal/AssessmentsSection";
import { TestSessionsSection } from "@/components/internal/TestSessionsSection";
import type { KanbanStage } from "@/components/internal/KanbanBoard";
import { CandidateHeader, type StageActionKind } from "@/components/internal/candidate/CandidateHeader";
import { ResumeCard } from "@/components/internal/candidate/ResumeCard";
import { ApplicationData, CandidateContact } from "@/components/internal/candidate/CandidateSummary";
import { CandidateEditForm, type CandidateProfilePatch } from "@/components/internal/candidate/CandidateEditForm";
import { ScreeningCriteria } from "@/components/internal/candidate/ScreeningCriteria";
import { TeamNotes } from "@/components/internal/candidate/TeamNotes";
import { CandidateHistory } from "@/components/internal/candidate/CandidateHistory";
import { MoveStageDialog } from "@/components/internal/candidate/MoveStageDialog";
import { RejectionDialog, buildRejectionNote } from "@/components/internal/candidate/RejectionDialog";
import { Section } from "@/components/internal/candidate/Section";
import type { CandidateDetail, LinkedAdmission } from "@/components/internal/candidate/types";

type Tab = "summary" | "assessments" | "history";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "summary", label: "Resumo" },
  { id: "assessments", label: "Avaliações" },
  { id: "history", label: "Histórico" },
];

interface Props {
  applicationId: string | null;
  canManage: boolean;
  stages: KanbanStage[];
  jobTitle?: string;
  onClose: () => void;
  /**
   * Chamado antes de mudar a etapa. Retorne false para interceptar (ex.: o Kanban abre o
   * modal de admissão ao mover para uma etapa de Admissão) — o drawer não faz o PATCH.
   */
  onBeforeStageChange?: (applicationId: string, stageId: string) => boolean;
}

/**
 * Workspace de triagem do candidato, aberto por cima do Kanban da vaga. Cabeçalho fixo
 * (quem é, etapa atual e a próxima ação) + abas Resumo / Avaliações / Histórico, com uma
 * única área rolável. Toda regra de etapa vem de candidate-stage-flow (módulo puro).
 */
export function CandidateDrawer({
  applicationId,
  canManage,
  stages,
  jobTitle,
  onClose,
  onBeforeStageChange,
}: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadSeq = useRef(0);

  const [data, setData] = useState<CandidateDetail | null>(null);
  const [error, setError] = useState(false);
  const [linkedAdmission, setLinkedAdmission] = useState<LinkedAdmission | null>(null);
  const [tab, setTab] = useState<Tab>("summary");

  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<Date | null>(null);

  const [pending, setPending] = useState<StageActionKind | null>(null);
  const [dialog, setDialog] = useState<"move" | "reject" | null>(null);

  // Última versão SALVA das notas — para não atropelar um rascunho numa recarga silenciosa.
  const savedNotesRef = useRef("");
  savedNotesRef.current = data?.notes ?? "";

  // ── Carregamento ──
  const load = useCallback(async (id: string, { silent = false } = {}) => {
    const seq = ++loadSeq.current;
    if (!silent) {
      setData(null);
      setError(false);
    }
    try {
      const res = await fetch(`/api/applications/${id}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as CandidateDetail;
      if (seq !== loadSeq.current) return;
      const previousSaved = savedNotesRef.current;
      setData(d);
      setNotesDraft((draft) => (silent && draft !== previousSaved ? draft : d.notes ?? ""));
    } catch {
      if (seq === loadSeq.current && !silent) setError(true);
    }
  }, []);

  useEffect(() => {
    if (!applicationId) return;
    let active = true;
    setTab("summary");
    setEditing(false);
    setDialog(null);
    setPending(null);
    setLinkedAdmission(null);
    setNotesSavedAt(null);
    void load(applicationId);
    fetch(`/api/applications/${applicationId}/admission`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && setLinkedAdmission(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [applicationId, load]);

  // ── Notas: salvar explícito (e automático ao fechar, para não perder rascunho) ──
  const saveNotes = useCallback(
    async (value: string, { quiet = false } = {}) => {
      if (!applicationId) return false;
      setNotesSaving(true);
      try {
        const res = await fetch(`/api/applications/${applicationId}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: value.trim() ? value : null }),
        });
        if (!res.ok) throw new Error();
        setData((d) => (d ? { ...d, notes: value } : d));
        setNotesSavedAt(new Date());
        if (!quiet) notify("success", "Anotação salva.");
        return true;
      } catch {
        notify("error", "Não foi possível salvar a anotação.");
        return false;
      } finally {
        setNotesSaving(false);
      }
    },
    [applicationId, notify]
  );

  const notesDirty = !!data && canManage && notesDraft !== (data.notes ?? "");

  const handleClose = useCallback(() => {
    if (notesDirty) void saveNotes(notesDraft, { quiet: true }).then((ok) => ok && notify("success", "Anotação salva."));
    onClose();
  }, [notesDirty, notesDraft, saveNotes, notify, onClose]);

  // ── Teclado, foco e scroll do fundo ──
  useEffect(() => {
    if (!applicationId) return;
    const onKey = (e: KeyboardEvent) => {
      // Menus e diálogos internos tratam o próprio Esc (preventDefault).
      if (e.key === "Escape" && !e.defaultPrevented && !dialog) handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [applicationId, dialog, handleClose]);

  useEffect(() => {
    if (!applicationId) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [applicationId]);

  // ── Fluxo de etapas ──
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

  if (!applicationId) return null;

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
        notify("error", kind === "reject" ? "Não foi possível reprovar a candidatura." : "Não foi possível mover o candidato.");
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
      await load(data.id, { silent: true });
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
    const block = buildRejectionNote(reason, note);
    const base = (canManage ? notesDraft : data.notes ?? "").trim();
    const notes = base ? `${base}\n\n${block}` : block;
    if (notes.length > 5000) {
      notify("error", "As anotações passaram do limite de 5.000 caracteres. Resuma a observação.");
      return;
    }
    const ok = await changeStage(flow.lost, "reject", { notes });
    if (ok) {
      setNotesDraft(notes);
      setDialog(null);
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
      setData((d) => (d ? { ...d, ...patch } : d));
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
      const res = await fetch(`/api/applications/${data.id}/resume`, {
        method: "PUT",
        credentials: "same-origin",
        body: form,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        notify("error", err.error ?? "Não foi possível enviar o currículo.");
        return;
      }
      const { resumeName } = (await res.json()) as { resumeName: string };
      setData((d) => (d ? { ...d, resumeName } : d));
      notify("success", data.resumeName ? "Currículo substituído." : "Currículo anexado.");
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setUploadingResume(false);
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

  const startEditing = () => {
    setTab("summary");
    setEditing(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
  };

  const selectTab = (t: Tab) => {
    setTab(t);
    scrollRef.current?.scrollTo({ top: 0 });
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

  const historyCount = data ? data.stageHistory.length : 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Fundo leve: o Kanban continua legível atrás do drawer. */}
      <div className="absolute inset-0 bg-[#1A2213]/25" onClick={handleClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full flex-col bg-white shadow-[-10px_0_34px_rgba(26,34,19,.14)] animate-in slide-in-from-right duration-200 sm:max-w-[600px] xl:max-w-[660px]"
      >
        <CandidateHeader
          data={data}
          jobTitle={jobTitle}
          flow={flow}
          canManage={canManage}
          pending={pending}
          enteredStageAt={enteredStageAt}
          titleId={titleId}
          closeRef={closeRef}
          onClose={handleClose}
          onChangeStage={(stage, kind) => void changeStage(stage, kind)}
          onOpenMove={() => setDialog("move")}
          onOpenReject={() => setDialog("reject")}
          onEdit={startEditing}
          onCopy={copy}
        />

        {/* Abas */}
        <div role="tablist" aria-label="Seções da ficha" className="flex shrink-0 gap-1 border-b border-wg-border-lighter px-5 sm:px-6" onKeyDown={onTabKeyDown}>
          {TABS.map((t) => {
            const selected = tab === t.id;
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
                  "-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wg-green/50",
                  selected
                    ? "border-wg-green-dark text-wg-ink"
                    : "border-transparent text-wg-ink-muted hover:text-wg-ink"
                )}
              >
                {t.label}
                {t.id === "history" && historyCount > 0 && (
                  <span className="rounded-full bg-neutral-bg px-1.5 text-[11px] tabular-nums text-neutral-fg">{historyCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Única área rolável do drawer */}
        <div
          ref={scrollRef}
          id={`${titleId}-panel`}
          role="tabpanel"
          aria-labelledby={`${titleId}-tab-${tab}`}
          className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-4 sm:px-6"
        >
          {error ? (
            <div className="py-10 text-center">
              <p className="text-body text-danger-fg">Não foi possível carregar a ficha do candidato.</p>
              <button
                type="button"
                onClick={() => void load(applicationId)}
                className="mt-2 text-meta font-semibold text-wg-green-dark hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : !data ? (
            <div className="space-y-5" aria-busy="true" aria-label="Carregando">
              <Skeleton className="h-10 w-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-52" />
              </div>
              <Skeleton className="h-24 w-full" />
            </div>
          ) : tab === "summary" ? (
            <>
              <ResumeCard
                applicationId={data.id}
                resumeName={data.resumeName}
                canManage={canManage}
                uploading={uploadingResume}
                onReplace={replaceResume}
              />
              {editing ? (
                <CandidateEditForm
                  data={data}
                  saving={savingProfile}
                  onCancel={() => setEditing(false)}
                  onSave={saveProfile}
                  onInvalid={(m) => notify("error", m)}
                />
              ) : (
                <>
                  <ApplicationData data={data} canManage={canManage} onEdit={startEditing} />
                  <CandidateContact data={data} onCopy={copy} />
                </>
              )}
              <ScreeningCriteria criteria={data.screeningCriteria} />
              <TeamNotes
                saved={data.notes ?? ""}
                draft={notesDraft}
                onDraftChange={setNotesDraft}
                canManage={canManage}
                saving={notesSaving}
                savedAt={notesSavedAt}
                onSave={() => void saveNotes(notesDraft)}
              />
              {linkedAdmission && (
                <Section
                  title="Admissão"
                  action={
                    <a
                      href={`/admissoes/${linkedAdmission.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-meta font-semibold text-wg-green-dark hover:underline"
                    >
                      Ver admissão
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2 text-meta text-wg-ink-muted">
                    {linkedAdmission.stage && (
                      <StageBadge color={linkedAdmission.stage.color}>{linkedAdmission.stage.name}</StageBadge>
                    )}
                    {linkedAdmission.digitalFormSubmittedAt ? (
                      <StatusBadge tone="success">Formulário preenchido</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">Formulário pendente</StatusBadge>
                    )}
                    {linkedAdmission.startDate && <span>Início previsto: {formatDate(linkedAdmission.startDate)}</span>}
                  </div>
                </Section>
              )}
            </>
          ) : tab === "assessments" ? (
            <div className="space-y-6">
              <TestSessionsSection
                applicationId={data.id}
                canManage={canManage}
                defaultTemplateId={
                  stages.find((s) => s.id === data.stageId && s.kind === "TEST")?.templateId ?? null
                }
              />
              <div className="border-t border-wg-border-lighter pt-4">
                <AssessmentsSection applicationId={data.id} canManage={canManage} hasResume={!!data.resumeName} />
              </div>
            </div>
          ) : (
            <CandidateHistory data={data} lostStageId={lostStageId} />
          )}
        </div>
      </div>

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
    </div>,
    document.body
  );
}
