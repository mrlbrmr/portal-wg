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

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", signal });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

/**
 * Dados do Quick View de UMA candidatura, carregados em paralelo e de forma independente:
 * a ficha (bloqueante) e as listas de avaliações, testes, anotações e admissão (cada uma
 * com o próprio estado de carregamento/erro — uma falha não derruba o painel). Ao trocar
 * de candidato (J/K), respostas atrasadas do anterior são descartadas.
 */
export function useCandidateWorkspace(applicationId: string | null) {
  const [data, setData] = useState<CandidateDetail | null>(null);
  const [error, setError] = useState(false);
  const [assessments, setAssessments] = useState<Loadable<AssessmentItem>>(EMPTY);
  const [sessions, setSessions] = useState<Loadable<TestSession>>(EMPTY);
  const [notes, setNotes] = useState<Loadable<ApplicationNote>>(EMPTY);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [admission, setAdmission] = useState<LinkedAdmission | null>(null);

  // Id em exibição — respostas de outro candidato são ignoradas.
  const activeId = useRef<string | null>(null);
  activeId.current = applicationId;

  const guard = useCallback(
    <T,>(id: string, fn: (value: T) => void) =>
      (value: T) => {
        if (activeId.current === id) fn(value);
      },
    []
  );

  const loadDetail = useCallback(
    (id: string, { silent = false } = {}) => {
      const ctrl = new AbortController();
      if (!silent) {
        setData(null);
        setError(false);
      }
      getJson<CandidateDetail>(`/api/applications/${id}`, ctrl.signal)
        .then(guard(id, (d: CandidateDetail) => setData(d)))
        .catch(() => {
          if (!ctrl.signal.aborted && !silent && activeId.current === id) setError(true);
        });
      return ctrl;
    },
    [guard]
  );

  const loadAssessments = useCallback(
    (id: string) => {
      const ctrl = new AbortController();
      getJson<{ assessments: AssessmentItem[] }>(`/api/applications/${id}/assessments`, ctrl.signal)
        .then(guard(id, (d: { assessments: AssessmentItem[] }) => setAssessments({ items: d.assessments, error: false })))
        .catch(() => !ctrl.signal.aborted && activeId.current === id && setAssessments((s) => ({ items: s.items ?? [], error: true })));
      return ctrl;
    },
    [guard]
  );

  const loadSessions = useCallback(
    (id: string) => {
      const ctrl = new AbortController();
      getJson<{ sessions: TestSession[] }>(`/api/assessment-sessions?applicationId=${encodeURIComponent(id)}`, ctrl.signal)
        .then(guard(id, (d: { sessions: TestSession[] }) => setSessions({ items: d.sessions, error: false })))
        .catch(() => !ctrl.signal.aborted && activeId.current === id && setSessions((s) => ({ items: s.items ?? [], error: true })));
      return ctrl;
    },
    [guard]
  );

  const loadNotes = useCallback(
    (id: string) => {
      const ctrl = new AbortController();
      getJson<{ notes: ApplicationNote[]; currentUserId: string }>(`/api/applications/${id}/notes`, ctrl.signal)
        .then(
          guard(id, (d: { notes: ApplicationNote[]; currentUserId: string }) => {
            setNotes({ items: d.notes, error: false });
            setCurrentUserId(d.currentUserId);
          })
        )
        .catch(() => !ctrl.signal.aborted && activeId.current === id && setNotes((s) => ({ items: s.items, error: true })));
      return ctrl;
    },
    [guard]
  );

  useEffect(() => {
    if (!applicationId) return;
    setAssessments(EMPTY);
    setSessions(EMPTY);
    setNotes(EMPTY);
    setAdmission(null);
    const ctrls = [
      loadDetail(applicationId),
      loadAssessments(applicationId),
      loadSessions(applicationId),
      loadNotes(applicationId),
    ];
    const admissionCtrl = new AbortController();
    getJson<LinkedAdmission | null>(`/api/applications/${applicationId}/admission`, admissionCtrl.signal)
      .then(guard(applicationId, (d: LinkedAdmission | null) => setAdmission(d)))
      .catch(() => {});
    return () => {
      ctrls.forEach((c) => c.abort());
      admissionCtrl.abort();
    };
  }, [applicationId, loadDetail, loadAssessments, loadSessions, loadNotes, guard]);

  return {
    data,
    setData,
    error,
    assessments,
    sessions,
    notes,
    setNotes,
    currentUserId,
    admission,
    reloadDetail: (opts?: { silent?: boolean }) => applicationId && loadDetail(applicationId, opts),
    reloadAssessments: () => applicationId && loadAssessments(applicationId),
    reloadSessions: () => applicationId && loadSessions(applicationId),
    reloadNotes: () => applicationId && loadNotes(applicationId),
  };
}
