"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  CalendarPlus,
  Code2,
  FileText,
  FlaskConical,
  GitCompareArrows,
  PanelRightOpen,
  SearchX,
  Send,
  Trash2,
  UserX,
} from "lucide-react";
import { normalizeText } from "@/lib/utils";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import {
  candidateSignals,
  pipelineSummary,
  type CandidateSignal,
} from "@/lib/recruitment/candidate-presentation";
import { candidateStageFlow, type FlowStage } from "@/lib/recruitment/candidate-stage-flow";
import { queuePosition } from "@/lib/recruitment/candidate-navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DropdownMenuItem } from "@/components/ui/DropdownMenu";
import type { ActiveChip, FilterSection } from "@/components/ui/FilterPopover";
import type { KanbanCardApi, KanbanColumnDef } from "@/components/internal/KanbanBoardShell";
import { CandidateQuickView } from "@/components/internal/candidate/CandidateQuickView";
import { InterviewModal } from "@/components/internal/InterviewModal";
import { AdmissionLinkModal, type AdmissionMeta } from "@/components/internal/AdmissionLinkModal";
import { MoveStageDialog } from "@/components/internal/candidate/MoveStageDialog";
import { RejectionDialog, buildRejectionNote } from "@/components/internal/candidate/RejectionDialog";
import { CandidateCard, type StageAction } from "./CandidateCard";
import { CandidateKanban } from "./CandidateKanban";
import { CandidateList, type ListRow } from "./CandidateList";
import { CandidateToolbar, type PipelineView } from "./CandidateToolbar";
import { CompareCandidatesDialog } from "./CompareCandidatesDialog";
import { PipelineSummary } from "./PipelineSummary";
import {
  EMPTY_FILTERS,
  MATCH_FILTER_LABELS,
  MAX_COMPARE,
  SIGNAL_FILTER_LABELS,
  SORT_OPTIONS,
  withStage,
  type CandidateFilters,
  type CandidateSortKey,
  type MatchFilter,
  type PipelineCandidate,
  type PipelineStage,
  type SignalFilter,
} from "./types";

interface Props {
  applications: PipelineCandidate[];
  stages: PipelineStage[];
  canManage: boolean;
  jobId: string;
  jobTitle?: string;
  admissionMeta?: AdmissionMeta | null;
}

const VIEW_STORAGE_KEY = "wg:vaga-candidatos:view";

interface Derived {
  score: number | undefined;
  signals: CandidateSignal[];
}

function matchBand(score: number | undefined): MatchFilter {
  if (score === undefined) return "none";
  if (score >= 80) return "high";
  if (score >= 60) return "mid";
  return "low";
}

function sortCandidates(list: PipelineCandidate[], sort: CandidateSortKey, derived: Map<string, Derived>) {
  if (sort === "default") return list;
  const score = (a: PipelineCandidate) => derived.get(a.id)?.score;
  // Sem data de entrada na etapa, o candidato vai para o fim em qualquer direção.
  const entered = (a: PipelineCandidate) => (a.enteredStageAt ? new Date(a.enteredStageAt).getTime() : null);
  const copy = [...list];
  switch (sort) {
    case "recent":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "oldest":
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "nameAZ":
      return copy.sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
    case "nameZA":
      return copy.sort((a, b) => b.fullName.localeCompare(a.fullName, "pt-BR"));
    case "scoreDesc":
      return copy.sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1));
    case "scoreAsc":
      return copy.sort((a, b) => (score(a) ?? 101) - (score(b) ?? 101));
    case "stageLongest":
      return copy.sort((a, b) => (entered(a) ?? Infinity) - (entered(b) ?? Infinity));
    case "stageShortest":
      return copy.sort((a, b) => (entered(b) ?? -Infinity) - (entered(a) ?? -Infinity));
  }
}

/**
 * Pipeline de candidatos de uma vaga: resumo, toolbar única (busca, filtros, ordenação,
 * Lista | Kanban, comparar) e as duas visões sobre o MESMO conjunto filtrado. Mantém as
 * regras de antes: gate de admissão ao mover para Admissão/Contratado, análise de IA em
 * segundo plano, envio de teste, registro de entrevista, exclusão LGPD com confirmação.
 */
export function CandidatePipeline({ applications, stages, canManage, jobId, jobTitle, admissionMeta }: Props) {
  const router = useRouter();
  const { notify } = useToast();

  // ── Estado de visualização ──
  const [view, setView] = useState<PipelineView>("kanban");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<CandidateSortKey>("default");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "list" || saved === "kanban") setView(saved);
    } catch {
      /* armazenamento indisponível: fica no padrão */
    }
  }, []);

  const changeView = (v: PipelineView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  // ── Estado de operação ──
  const [detailId, setDetailId] = useState<string | null>(null);
  /** Fila de triagem do Quick View: a ordem visível no momento em que o candidato foi aberto. */
  const [queue, setQueue] = useState<string[]>([]);
  const lastQueueIndex = useRef<number | null>(null);
  const [pendingAdmission, setPendingAdmission] = useState<{ candidateId: string; toStageId: string } | null>(null);
  const [aiScoreOverrides, setAiScoreOverrides] = useState<Map<string, number>>(new Map());
  const [sendingTestFor, setSendingTestFor] = useState<string | null>(null);
  const [interviewTarget, setInterviewTarget] = useState<{ applicationId: string; candidateName: string } | null>(null);
  const [stageOverrides, setStageOverrides] = useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ kind: "move" | "reject" | "delete"; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const analyzedRef = useRef(new Set<string>());

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const lostStage = useMemo(() => stages.find((s) => s.kind === "LOST") ?? null, [stages]);

  // Analisa candidatos com PDF sem score IA ainda — uma vez no mount, em segundo plano.
  useEffect(() => {
    if (!canManage) return;
    const toAnalyze = applications.filter(
      (a) => a.resumeName?.toLowerCase().endsWith(".pdf") && a.aiScore === undefined && !analyzedRef.current.has(a.id)
    );
    if (toAnalyze.length === 0) return;
    toAnalyze.forEach((a) => analyzedRef.current.add(a.id));
    let active = true;
    void (async () => {
      for (const app of toAnalyze.slice(0, 20)) {
        if (!active) break;
        try {
          const res = await fetch(`/api/applications/${app.id}/analyze`, { method: "POST", credentials: "same-origin" });
          if (res.ok) {
            const { score } = (await res.json()) as { score?: number };
            if (active && typeof score === "number") {
              setAiScoreOverrides((prev) => new Map(prev).set(app.id, score));
            }
          }
        } catch {
          /* tarefa de fundo — ignora */
        }
        if (active) await new Promise((r) => setTimeout(r, 800));
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intencional: roda uma vez no mount

  // O servidor confirmou a nova etapa (router.refresh) → descarta o override otimista.
  useEffect(() => {
    setStageOverrides((o) => {
      const keys = Object.keys(o);
      if (keys.length === 0) return o;
      const next = { ...o };
      let changed = false;
      for (const a of applications) {
        if (next[a.id] !== undefined && next[a.id] === a.stageId) {
          delete next[a.id];
          changed = true;
        }
      }
      return changed ? next : o;
    });
  }, [applications]);

  // ── Dados: servidor + estado otimista local ──
  const all = useMemo(
    () =>
      applications
        .filter((a) => !deletedIds.has(a.id))
        .map((a) => (stageOverrides[a.id] ? withStage(a, stageOverrides[a.id]) : a)),
    [applications, deletedIds, stageOverrides]
  );

  const allById = useMemo(() => new Map(all.map((a) => [a.id, a])), [all]);

  const derived = useMemo(() => {
    const now = new Date();
    const m = new Map<string, Derived>();
    for (const a of all) {
      const score = aiScoreOverrides.get(a.id) ?? a.aiScore;
      m.set(a.id, {
        score,
        signals: candidateSignals({ ...a, hasScore: score !== undefined }, stageById.get(a.stageId), now),
      });
    }
    return m;
  }, [all, aiScoreOverrides, stageById]);

  const q = normalizeText(deferredQuery);
  const qDigits = deferredQuery.replace(/\D/g, "");
  const filtering =
    q.length > 0 ||
    filters.stages.length > 0 ||
    filters.sources.length > 0 ||
    filters.match !== "" ||
    filters.signals.length > 0;

  const visible = useMemo(() => {
    let r = all;
    if (filters.stages.length) r = r.filter((a) => filters.stages.includes(a.stageId));
    if (filters.sources.length) r = r.filter((a) => filters.sources.includes(a.source));
    if (filters.match) r = r.filter((a) => matchBand(derived.get(a.id)?.score) === filters.match);
    if (filters.signals.includes("attention")) r = r.filter((a) => derived.get(a.id)?.signals.some((s) => s.attention));
    if (filters.signals.includes("notes")) r = r.filter((a) => a.hasNotes);
    if (filters.signals.includes("noResume")) r = r.filter((a) => !a.resumeName);
    if (q) {
      r = r.filter(
        (a) =>
          [a.fullName, a.email, a.lastPosition, a.city, a.state].some((v) => v && normalizeText(v).includes(q)) ||
          (qDigits.length >= 4 && a.phone.replace(/\D/g, "").includes(qDigits))
      );
    }
    return sortCandidates(r, sort, derived);
  }, [all, filters, derived, q, qDigits, sort]);

  const summary = useMemo(() => pipelineSummary(all, stages as FlowStage[]), [all, stages]);
  const attentionCount = useMemo(
    () => all.filter((a) => derived.get(a.id)?.signals.some((s) => s.attention)).length,
    [all, derived]
  );

  // ── Seleção para comparar ──
  const existingIds = useMemo(() => new Set(all.map((a) => a.id)), [all]);
  const selectedIds = useMemo(() => new Set([...selected].filter((id) => existingIds.has(id))), [selected, existingIds]);

  const toggleSelect = useCallback(
    (id: string) => {
      if (!selectedIds.has(id) && selectedIds.size >= MAX_COMPARE) {
        notify("info", `Compare até ${MAX_COMPARE} candidatos por vez.`);
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [selectedIds, notify]
  );

  const toggleAll = (ids: string[], select: boolean) => {
    if (!select) {
      setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
      return;
    }
    const room = MAX_COMPARE - selectedIds.size;
    const toAdd = ids.filter((id) => !selectedIds.has(id)).slice(0, Math.max(0, room));
    if (toAdd.length < ids.filter((id) => !selectedIds.has(id)).length) {
      notify("info", `Compare até ${MAX_COMPARE} candidatos por vez — selecionados os ${MAX_COMPARE} primeiros.`);
    }
    setSelected((prev) => new Set([...prev, ...toAdd]));
  };

  // ── Mudança de etapa (menu ⋯, diálogo) ──
  const handleBeforeMove = useCallback(
    (id: string, toStageId: string): boolean => {
      if (admissionMeta && ["ADMISSION", "WON"].includes(stageById.get(toStageId)?.kind ?? "")) {
        setPendingAdmission({ candidateId: id, toStageId });
        return false;
      }
      return true;
    },
    [admissionMeta, stageById]
  );

  const patchApplication = (id: string, body: Record<string, unknown>) =>
    fetch(`/api/applications/${id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const applyOptimisticStage = (id: string, stageId: string) => {
    const prev = stageOverrides[id];
    setStageOverrides((o) => ({ ...o, [id]: stageId }));
    return () =>
      setStageOverrides((o) => {
        const next = { ...o };
        if (prev === undefined) delete next[id];
        else next[id] = prev;
        return next;
      });
  };

  async function moveCandidate(id: string, toStageId: string) {
    const c = all.find((a) => a.id === id);
    if (!c || c.stageId === toStageId) return true;
    if (!handleBeforeMove(id, toStageId)) return true; // o modal de admissão assume daqui
    const revert = applyOptimisticStage(id, toStageId);
    try {
      const res = await patchApplication(id, { stageId: toStageId });
      if (!res.ok) throw new Error();
      notify("success", `${c.fullName} movido para ${stageById.get(toStageId)?.name ?? "a nova etapa"}.`);
      router.refresh();
      return true;
    } catch {
      revert();
      notify("error", "Não foi possível mover o candidato.");
      return false;
    }
  }

  async function rejectCandidate(id: string, reason: string, note: string) {
    const c = all.find((a) => a.id === id);
    if (!c || !lostStage) return;
    setBusy(true);
    try {
      // As anotações atuais recebem o motivo no mesmo formato usado pelo drawer.
      const detail = await fetch(`/api/applications/${id}`, { credentials: "same-origin" });
      if (!detail.ok) throw new Error();
      const { notes: current } = (await detail.json()) as { notes: string | null };
      const block = buildRejectionNote(reason, note);
      const base = (current ?? "").trim();
      const notes = base ? `${base}\n\n${block}` : block;
      if (notes.length > 5000) {
        notify("error", "As anotações passaram do limite de 5.000 caracteres. Resuma a observação.");
        return;
      }
      const revert = applyOptimisticStage(id, lostStage.id);
      const res = await patchApplication(id, { stageId: lostStage.id, notes });
      if (!res.ok) {
        revert();
        throw new Error();
      }
      notify("success", `Candidatura de ${c.fullName} reprovada.`);
      setDialog(null);
      router.refresh();
    } catch {
      notify("error", "Não foi possível reprovar a candidatura.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCandidate(id: string) {
    const c = all.find((a) => a.id === id);
    setDeletedIds((s) => new Set(s).add(id));
    const revert = () =>
      setDeletedIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    try {
      const res = await fetch(`/api/applications/${id}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) {
        revert();
        const data = await res.json().catch(() => ({}));
        notify("error", typeof data.error === "string" ? data.error : "Erro ao excluir candidatura.");
        return;
      }
      notify("success", c ? `Candidatura de ${c.fullName} excluída.` : "Candidatura excluída.");
      router.refresh();
    } catch {
      revert();
      notify("error", "Erro de conexão. Tente novamente.");
    }
  }

  async function handleAdmissionSuccess() {
    if (!pendingAdmission) return;
    const { candidateId, toStageId } = pendingAdmission;
    setPendingAdmission(null);
    await patchApplication(candidateId, { stageId: toStageId });
    router.refresh();
  }

  async function handleSendTest(applicationId: string, templateId: string) {
    setSendingTestFor(applicationId);
    try {
      const res = await fetch("/api/assessment-sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, templateId }),
      });
      const data = (await res.json()) as { error?: string; url?: string; token?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar sessão");
      const url = data.url ?? `${window.location.origin}/avaliacao/${data.token}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      notify("success", "Link de teste copiado! Envie ao candidato.");
      router.refresh();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Erro ao enviar teste.");
    } finally {
      setSendingTestFor(null);
    }
  }

  // ── Ações por candidato ──
  function testActionFor(c: PipelineCandidate): StageAction | null {
    const stage = stageById.get(c.stageId);
    if (!canManage || stage?.kind !== "TEST" || !stage.templateId) return null;
    const templateId = stage.templateId;
    const base =
      stage.templateKind === "PERSONALITY_BIG5"
        ? "Big Five"
        : stage.templateName ?? "teste";
    const resend = c.testStatus === "AWAITING";
    return {
      label: sendingTestFor === c.id ? "Criando link…" : resend ? "Reenviar link do teste" : `Enviar ${base}`,
      icon: stage.templateKind === "PERSONALITY_BIG5" ? Send : stage.templateKind === "TECHNICAL" ? Code2 : FlaskConical,
      busy: sendingTestFor === c.id,
      onClick: () => void handleSendTest(c.id, templateId),
    };
  }

  function interviewActionFor(c: PipelineCandidate): StageAction | null {
    const stage = stageById.get(c.stageId);
    if (!canManage || !stage || !/entrevista/i.test(stage.name)) return null;
    return {
      label: "Registrar entrevista",
      icon: CalendarPlus,
      onClick: () => setInterviewTarget({ applicationId: c.id, candidateName: c.fullName }),
    };
  }

  /** Próxima ação no card: só quando ainda há algo a fazer na etapa. */
  function cardActionFor(c: PipelineCandidate): StageAction | null {
    const test = testActionFor(c);
    if (test) return c.testStatus === undefined || c.testStatus === "NOT_SENT" || c.testStatus === "AWAITING" ? test : null;
    return interviewActionFor(c);
  }

  function menuFor(c: PipelineCandidate): DropdownMenuItem[] {
    const stage = stageById.get(c.stageId);
    const items: DropdownMenuItem[] = [
      { label: "Abrir candidato", icon: PanelRightOpen, onSelect: () => openCandidate(c.id) },
    ];
    if (c.resumeName) {
      items.push({ label: "Ver currículo", icon: FileText, href: `/api/applications/${c.id}/resume`, external: true });
    }
    items.push({
      label: selectedIds.has(c.id) ? "Remover da comparação" : "Selecionar para comparar",
      icon: GitCompareArrows,
      onSelect: () => toggleSelect(c.id),
    });
    if (!canManage) return items;

    const test = testActionFor(c);
    const interview = interviewActionFor(c);
    if (test || interview) items.push({ type: "separator" });
    if (test) items.push({ label: test.label, icon: test.icon, onSelect: test.onClick, disabled: test.busy });
    if (interview) items.push({ label: interview.label, icon: interview.icon, onSelect: interview.onClick });

    items.push({ type: "separator" });
    items.push({ label: "Mover para etapa…", icon: ArrowRightLeft, onSelect: () => setDialog({ kind: "move", id: c.id }) });
    if (lostStage && stage?.kind !== "LOST") {
      items.push({ label: "Reprovar…", icon: UserX, onSelect: () => setDialog({ kind: "reject", id: c.id }) });
    }
    items.push({ type: "separator" });
    items.push({
      label: "Excluir candidatura",
      icon: Trash2,
      danger: true,
      onSelect: () => setDialog({ kind: "delete", id: c.id }),
    });
    return items;
  }

  // ── Filtros ──
  const countBy = (pred: (a: PipelineCandidate) => boolean) => all.filter(pred).length;
  const sourcesPresent = [...new Set(all.map((a) => a.source))];
  const toggleIn = <K extends "stages" | "sources" | "signals">(key: K, value: CandidateFilters[K][number]) =>
    setFilters((f) => {
      const list = f[key] as string[];
      return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });

  const filterSections: FilterSection[] = [
    {
      key: "stage",
      title: "Etapa",
      options: stages.map((s) => ({
        value: s.id,
        label: s.hideFromBoard ? `${s.name} (fora do Kanban)` : s.name,
        count: countBy((a) => a.stageId === s.id),
      })),
      selected: filters.stages,
      onToggle: (v) => toggleIn("stages", v),
    },
    {
      key: "source",
      title: "Origem",
      options: sourcesPresent.map((s) => ({
        value: s,
        label: APPLICATION_SOURCE_LABELS[s] ?? s,
        count: countBy((a) => a.source === s),
      })),
      selected: filters.sources,
      onToggle: (v) => toggleIn("sources", v),
    },
    {
      key: "match",
      title: "Aderência ao perfil",
      mode: "single",
      options: (Object.keys(MATCH_FILTER_LABELS) as MatchFilter[]).map((m) => ({
        value: m,
        label: MATCH_FILTER_LABELS[m],
        count: countBy((a) => matchBand(derived.get(a.id)?.score) === m),
      })),
      selected: filters.match ? [filters.match] : [],
      onToggle: (v) => setFilters((f) => ({ ...f, match: f.match === v ? "" : (v as MatchFilter) })),
    },
    {
      key: "signals",
      title: "Sinais",
      options: (Object.keys(SIGNAL_FILTER_LABELS) as SignalFilter[]).map((s) => ({
        value: s,
        label: SIGNAL_FILTER_LABELS[s],
        count: countBy((a) =>
          s === "attention"
            ? !!derived.get(a.id)?.signals.some((x) => x.attention)
            : s === "notes"
            ? a.hasNotes
            : !a.resumeName
        ),
      })),
      selected: filters.signals,
      onToggle: (v) => toggleIn("signals", v as SignalFilter),
    },
  ];

  const activeChips: ActiveChip[] = [
    ...filters.stages.map((id) => ({
      key: `stage-${id}`,
      label: `Etapa: ${stageById.get(id)?.name ?? id}`,
      onRemove: () => toggleIn("stages", id),
    })),
    ...filters.sources.map((s) => ({
      key: `source-${s}`,
      label: `Origem: ${APPLICATION_SOURCE_LABELS[s] ?? s}`,
      onRemove: () => toggleIn("sources", s),
    })),
    ...(filters.match
      ? [{ key: "match", label: `Aderência: ${MATCH_FILTER_LABELS[filters.match]}`, onRemove: () => setFilters((f) => ({ ...f, match: "" as const })) }]
      : []),
    ...filters.signals.map((s) => ({
      key: `signal-${s}`,
      label: SIGNAL_FILTER_LABELS[s],
      onRemove: () => toggleIn("signals", s),
    })),
  ];
  const activeFilterCount = activeChips.length;
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  };

  // ── Kanban ──
  const columns: KanbanColumnDef[] = useMemo(
    () =>
      stages
        .filter((s) => !s.hideFromBoard && (filters.stages.length === 0 || filters.stages.includes(s.id)))
        .map((s) => ({
          key: s.id,
          label: s.name,
          dotColor: s.color,
          kind: s.kind,
          subtitle: s.kind === "TEST" && s.templateName ? s.templateName : undefined,
        })),
    [stages, filters.stages]
  );
  const boardKeys = new Set(columns.map((c) => c.key));

  // ── Quick View: fila de triagem (J/K, ‹ ›) ──
  // Na lista, a ordem visível; no Kanban, coluna a coluna. A fila é "congelada" ao abrir:
  // avançar/reprovar alguém não embaralha a sequência que o recrutador está percorrendo.
  const navOrder =
    view === "list"
      ? visible.map((a) => a.id)
      : columns.flatMap((col) => visible.filter((a) => a.stageId === col.key).map((a) => a.id));
  const navOrderRef = useRef(navOrder);
  navOrderRef.current = navOrder;
  const openCandidate = useCallback((id: string) => {
    const order = navOrderRef.current;
    setQueue(order.includes(id) ? order : [id, ...order]);
    lastQueueIndex.current = null;
    setDetailId(id);
  }, []);
  const liveQueue = queue.filter((id) => !deletedIds.has(id));
  const queuePos = queuePosition(liveQueue, detailId, lastQueueIndex.current);
  if (queuePos.index !== null) lastQueueIndex.current = queuePos.index - 1;
  const queueNav = {
    index: queuePos.index,
    total: queuePos.total,
    prevId: queuePos.prevId,
    nextId: queuePos.nextId,
    onPrev: queuePos.prevId ? () => setDetailId(queuePos.prevId) : null,
    onNext: queuePos.nextId ? () => setDetailId(queuePos.nextId) : null,
  };
  const onBoardCount = visible.filter((a) => boardKeys.has(a.stageId)).length;

  const renderCard = (c: PipelineCandidate, api: KanbanCardApi) => {
    const d = derived.get(c.id);
    // O card pode estar numa coluna nova (arraste ainda não confirmado): sinais pela etapa atual.
    const signals =
      d && allById.get(c.id)?.stageId === c.stageId ? d.signals : candidateSignals({ ...c, hasScore: d?.score !== undefined }, stageById.get(c.stageId));
    return (
      <CandidateCard
        candidate={c}
        score={d?.score}
        signals={signals}
        selected={selectedIds.has(c.id)}
        active={c.id === detailId}
        selectionActive={selectedIds.size > 0}
        menuItems={menuFor(c)}
        stageAction={cardActionFor(c)}
        onOpen={openCandidate}
        onToggleSelect={toggleSelect}
        drag={api.drag}
      />
    );
  };

  const listRows: ListRow[] = visible.map((c) => ({
    candidate: c,
    score: derived.get(c.id)?.score,
    signals: derived.get(c.id)?.signals ?? [],
    menuItems: menuFor(c),
  }));

  const noResults = (
    <div className="rounded-card border border-dashed border-wg-border-light bg-white">
      <EmptyState
        icon={SearchX}
        title="Nenhum candidato encontrado"
        description={
          q
            ? `Nada corresponde a “${deferredQuery.trim()}”${activeFilterCount ? " com os filtros atuais" : ""}.`
            : "Nenhum candidato corresponde aos filtros atuais."
        }
        action={
          <Button variant="secondary" size="sm" onClick={clearAll}>
            Limpar busca e filtros
          </Button>
        }
      />
    </div>
  );

  const dialogCandidate = dialog ? all.find((a) => a.id === dialog.id) ?? null : null;
  const moveTargets = dialogCandidate
    ? candidateStageFlow(stages as FlowStage[], dialogCandidate.stageId).moveTargets
    : [];
  const pendingCandidate = pendingAdmission ? all.find((a) => a.id === pendingAdmission.candidateId) ?? null : null;
  const compareEntries = [...selectedIds]
    .map((id) => all.find((a) => a.id === id))
    .filter((a): a is PipelineCandidate => !!a)
    .map((c) => ({ candidate: c, score: derived.get(c.id)?.score, signals: derived.get(c.id)?.signals ?? [] }));

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label;

  return (
    <>
      <PipelineSummary summary={summary} attention={attentionCount} className="mb-5" />

      <CandidateToolbar
        query={query}
        onQueryChange={setQuery}
        filterSections={filterSections}
        activeFilterCount={activeFilterCount}
        activeChips={activeChips}
        onClearFilters={clearFilters}
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={changeView}
        selectedCount={selectedIds.size}
        onCompare={() => setCompareOpen(true)}
        onClearSelection={() => setSelected(new Set())}
        resultCount={filtering ? visible.length : null}
      />

      <div className="mt-4">
        {view === "list" ? (
          visible.length === 0 ? (
            noResults
          ) : (
            <CandidateList
              rows={listRows}
              stageById={stageById}
              sort={sort}
              onSortChange={setSort}
              selected={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
              onOpen={openCandidate}
              activeId={detailId}
            />
          )
        ) : columns.length === 0 ? (
          <div className="rounded-card border border-dashed border-wg-border-light bg-white">
            <EmptyState
              icon={SearchX}
              title="As etapas filtradas ficam fora do Kanban"
              description="Pausados e reprovados não têm coluna no quadro. Veja-os na Lista."
              action={
                <Button variant="secondary" size="sm" onClick={() => changeView("list")}>
                  Ver na lista
                </Button>
              }
            />
          </div>
        ) : filtering && onBoardCount === 0 ? (
          noResults
        ) : (
          <>
            {sort !== "default" && (
              <p className="mb-2 text-[12.5px] text-wg-ink-muted">
                Ordenado por <span className="font-medium text-wg-ink-secondary">{sortLabel?.toLowerCase()}</span> — a
                reordenação manual fica pausada.{" "}
                <button
                  type="button"
                  onClick={() => setSort("default")}
                  className="font-semibold text-wg-green-dark hover:underline"
                >
                  Voltar à ordem do funil
                </button>
              </p>
            )}
            <CandidateKanban
              items={visible}
              columns={columns}
              canManage={canManage}
              orderMode={sort === "default" ? "manual" : "external"}
              onBeforeMove={handleBeforeMove}
              onMoved={() => router.refresh()}
              renderCard={renderCard}
            />
          </>
        )}
      </div>

      <CompareCandidatesDialog
        open={compareOpen && compareEntries.length >= 2}
        entries={compareEntries}
        stageById={stageById}
        onClose={() => setCompareOpen(false)}
        onOpen={(id) => {
          setCompareOpen(false);
          openCandidate(id);
        }}
        onRemove={(id) => toggleSelect(id)}
      />

      {dialogCandidate && (
        <>
          <MoveStageDialog
            open={dialog?.kind === "move"}
            candidateName={dialogCandidate.fullName}
            currentStageName={stageById.get(dialogCandidate.stageId)?.name ?? null}
            targets={moveTargets}
            busy={busy}
            onCancel={() => setDialog(null)}
            onConfirm={async (stageId) => {
              setBusy(true);
              const ok = await moveCandidate(dialogCandidate.id, stageId);
              setBusy(false);
              if (ok) setDialog(null);
            }}
          />
          {lostStage && (
            <RejectionDialog
              open={dialog?.kind === "reject"}
              candidateName={dialogCandidate.fullName}
              targetStageName={lostStage.name}
              busy={busy}
              onCancel={() => setDialog(null)}
              onConfirm={(reason, note) => void rejectCandidate(dialogCandidate.id, reason, note)}
            />
          )}
        </>
      )}

      <ConfirmModal
        isOpen={dialog?.kind === "delete"}
        title="Excluir candidatura?"
        message={`A candidatura de "${dialogCandidate?.fullName ?? ""}" e o currículo serão removidos permanentemente (LGPD). Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        variant="danger"
        onConfirm={() => {
          if (dialog) void deleteCandidate(dialog.id);
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />

      <CandidateQuickView
        applicationId={detailId}
        canManage={canManage}
        stages={stages}
        jobTitle={jobTitle}
        knownScore={detailId ? derived.get(detailId)?.score : undefined}
        nav={queueNav}
        onScoreChange={(id, score) => setAiScoreOverrides((prev) => new Map(prev).set(id, score))}
        onClose={() => setDetailId(null)}
        onBeforeStageChange={(id, toStageId) => {
          // Mesmo gate do arrastar no Kanban: Admissão/Contratado abre o modal de admissão.
          if (handleBeforeMove(id, toStageId)) return true;
          setDetailId(null);
          return false;
        }}
      />

      <AdmissionLinkModal
        open={pendingAdmission !== null}
        candidate={
          pendingCandidate
            ? {
                id: pendingCandidate.id,
                fullName: pendingCandidate.fullName,
                email: pendingCandidate.email,
                phone: pendingCandidate.phone,
                jobId,
              }
            : null
        }
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
