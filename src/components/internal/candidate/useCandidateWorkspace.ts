"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplicationNote } from "@/lib/application-notes";
import type {
  AssessmentItem,
  CandidateDetail,
  LinkedAdmission,
  Loadable,
  TestSession,
} from "./types";

const EMPTY: Loadable<never> = { items: null, error: false };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", signal });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

/** O que já foi carregado de um candidato — reaparece na hora ao voltar a ele (J/K). */
interface Snapshot {
  data?: CandidateDetail;
  assessments?: AssessmentItem[];
  sessions?: TestSession[];
  notes?: ApplicationNote[];
  currentUserId?: string | null;
  admission?: LinkedAdmission | null;
}

/**
 * Dados do Quick View de UMA candidatura, carregados em paralelo e de forma independente:
 * a ficha (bloqueante) e as listas de avaliações, testes, anotações e admissão (cada uma
 * com o próprio estado de carregamento/erro — uma falha não derruba o painel).
 *
 * Navegação rápida: o que já foi visto fica em cache por candidato e aparece na hora
 * (e é revalidado em segundo plano); `prefetch` adianta a ficha e as avaliações dos
 * vizinhos da fila. Ao trocar de candidato, respostas atrasadas do anterior são descartadas.
 */
export function useCandidateWorkspace(applicationId: string | null) {
  const [data, setData] = useState<CandidateDetail | null>(null);
  const [error, setError] = useState(false);
  const [assessments, setAssessments] = useState<Loadable<AssessmentItem>>(EMPTY);
  const [sessions, setSessions] = useState<Loadable<TestSession>>(EMPTY);
  const [notes, setNotes] = useState<Loadable<ApplicationNote>>(EMPTY);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [admission, setAdmission] = useState<LinkedAdmission | null>(null);

  const cache = useRef(new Map<string, Snapshot>());
  const prefetching = useRef(new Set<string>());
  const remember = useCallback((id: string, patch: Snapshot) => {
    cache.current.set(id, { ...cache.current.get(id), ...patch });
  }, []);

  // Id em exibição — respostas de outro candidato são ignoradas (mas vão para o cache).
  const activeId = useRef<string | null>(null);
  activeId.current = applicationId;
  const isActive = (id: string) => activeId.current === id;

  const loadDetail = useCallback(
    (id: string, { silent = false } = {}) => {
      const ctrl = new AbortController();
      if (!silent) {
        setData(null);
        setError(false);
      }
      getJson<CandidateDetail>(`/api/applications/${id}`, ctrl.signal)
        .then((d) => {
          remember(id, { data: d });
          if (isActive(id)) setData(d);
        })
        .catch(() => {
          if (!ctrl.signal.aborted && !silent && isActive(id)) setError(true);
        });
      return ctrl;
    },
    [remember]
  );

  const loadAssessments = useCallback(
    (id: string) => {
      const ctrl = new AbortController();
      getJson<{ assessments: AssessmentItem[] }>(`/api/applications/${id}/assessments`, ctrl.signal)
        .then((d) => {
          remember(id, { assessments: d.assessments });
          if (isActive(id)) setAssessments({ items: d.assessments, error: false });
        })
        .catch(() => !ctrl.signal.aborted && isActive(id) && setAssessments((s) => ({ items: s.items ?? [], error: true })));
      return ctrl;
    },
    [remember]
  );

  const loadSessions = useCallback(
    (id: string) => {
      const ctrl = new AbortController();
      getJson<{ sessions: TestSession[] }>(`/api/assessment-sessions?applicationId=${encodeURIComponent(id)}`, ctrl.signal)
        .then((d) => {
          remember(id, { sessions: d.sessions });
          if (isActive(id)) setSessions({ items: d.sessions, error: false });
        })
        .catch(() => !ctrl.signal.aborted && isActive(id) && setSessions((s) => ({ items: s.items ?? [], error: true })));
      return ctrl;
    },
    [remember]
  );

  const loadNotes = useCallback(
    (id: string) => {
      const ctrl = new AbortController();
      getJson<{ notes: ApplicationNote[]; currentUserId: string }>(`/api/applications/${id}/notes`, ctrl.signal)
        .then((d) => {
          remember(id, { notes: d.notes, currentUserId: d.currentUserId });
          if (!isActive(id)) return;
          setNotes({ items: d.notes, error: false });
          setCurrentUserId(d.currentUserId);
        })
        .catch(() => !ctrl.signal.aborted && isActive(id) && setNotes((s) => ({ items: s.items, error: true })));
      return ctrl;
    },
    [remember]
  );

  useEffect(() => {
    if (!applicationId) return;
    const snap = cache.current.get(applicationId);
    // Mostra o que já se conhece deste candidato; o resto aparece como carregando.
    setData(snap?.data ?? null);
    setError(false);
    setAssessments(snap?.assessments ? { items: snap.assessments, error: false } : EMPTY);
    setSessions(snap?.sessions ? { items: snap.sessions, error: false } : EMPTY);
    setNotes(snap?.notes ? { items: snap.notes, error: false } : EMPTY);
    if (snap?.currentUserId !== undefined) setCurrentUserId(snap.currentUserId);
    setAdmission(snap?.admission ?? null);

    const ctrls = [
      loadDetail(applicationId, { silent: !!snap?.data }),
      loadAssessments(applicationId),
      loadSessions(applicationId),
      loadNotes(applicationId),
    ];
    const admissionCtrl = new AbortController();
    const id = applicationId;
    getJson<LinkedAdmission | null>(`/api/applications/${id}/admission`, admissionCtrl.signal)
      .then((d) => {
        remember(id, { admission: d });
        if (activeId.current === id) setAdmission(d);
      })
      .catch(() => {});
    return () => {
      ctrls.forEach((c) => c.abort());
      admissionCtrl.abort();
    };
  }, [applicationId, loadDetail, loadAssessments, loadSessions, loadNotes, remember]);

  // Mudanças locais (dados editados, anotação criada…) também valem para o cache. A ficha
  // traz o próprio id; as anotações não, então são gravadas pelo setter abaixo.
  useEffect(() => {
    if (applicationId && data?.id === applicationId) remember(applicationId, { data });
  }, [applicationId, data, remember]);

  const updateNotes = useCallback(
    (update: (s: Loadable<ApplicationNote>) => Loadable<ApplicationNote>) => {
      const id = activeId.current;
      setNotes((s) => {
        const next = update(s);
        if (id && next.items) remember(id, { notes: next.items });
        return next;
      });
    },
    [remember]
  );

  /** Adianta o que a Visão geral precisa de um vizinho da fila (sem tocar no estado atual). */
  const prefetch = useCallback(
    (id: string | null | undefined) => {
      if (!id || cache.current.get(id)?.data || prefetching.current.has(id)) return;
      prefetching.current.add(id);
      Promise.allSettled([
        getJson<CandidateDetail>(`/api/applications/${id}`).then((d) => remember(id, { data: d })),
        getJson<{ assessments: AssessmentItem[] }>(`/api/applications/${id}/assessments`).then((d) =>
          remember(id, { assessments: d.assessments })
        ),
      ]).finally(() => prefetching.current.delete(id));
    },
    [remember]
  );

  return {
    data,
    setData,
    error,
    assessments,
    sessions,
    notes,
    setNotes: updateNotes,
    currentUserId,
    admission,
    prefetch,
    reloadDetail: (opts?: { silent?: boolean }) => applicationId && loadDetail(applicationId, opts),
    reloadAssessments: () => applicationId && loadAssessments(applicationId),
    reloadSessions: () => applicationId && loadSessions(applicationId),
    reloadNotes: () => applicationId && loadNotes(applicationId),
  };
}
