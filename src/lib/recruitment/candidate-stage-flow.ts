// Fluxo de etapas de UMA candidatura — módulo puro, consumido pelo drawer do candidato.
//
// O funil é configurável (application_stages): `kind` dá o significado (OPEN, TEST,
// ADMISSION, WON, LOST) e `hideFromBoard` marca etapas fora do Kanban (ex.: "Pausada").
// A progressão linear ("Avançar para …") segue só as etapas VISÍVEIS e não-LOST, na
// ordem configurada — assim "Avançar" nunca leva o candidato para uma etapa oculta.
// A UI exibe apenas as ações que este módulo devolve; nada de botão impossível.

export interface FlowStage {
  id: string;
  name: string;
  color: string;
  kind?: string;
  hideFromBoard?: boolean;
}

export type CandidateFlowStatus =
  /** Em andamento dentro do funil visível. */
  | "OPEN"
  /** Última etapa do funil (ou etapa WON): não há para onde avançar. */
  | "FINAL"
  /** Reprovada (etapa kind=LOST). */
  | "LOST"
  /** Em etapa fora do funil visível (ex.: "Pausada"). */
  | "OFF_PIPELINE";

export interface CandidateStageFlow {
  current: FlowStage | null;
  status: CandidateFlowStatus;
  /** Posição 1-based no funil visível (null fora dele). */
  position: { index: number; total: number } | null;
  /** Próxima etapa do funil — alvo do CTA principal. */
  next: FlowStage | null;
  /** Etapa anterior do funil — ação "Voltar etapa". */
  previous: FlowStage | null;
  /** Para reprovados/pausados: etapa do funil onde retomar (a última em que esteve). */
  resumeTo: FlowStage | null;
  /** Etapa de reprovação disponível (null se já reprovado ou se o funil não tem LOST). */
  lost: FlowStage | null;
  /** Destinos de "Mover para outra etapa" (tudo menos a atual e a de reprovação). */
  moveTargets: FlowStage[];
}

/** Etapas do funil linear: visíveis no Kanban e que não são de reprovação. */
export function pipelineStages<T extends FlowStage>(stages: T[]): T[] {
  return stages.filter((s) => s.kind !== "LOST" && !s.hideFromBoard);
}

/**
 * @param stages      etapas ativas da vaga, já na ordem do funil (sortOrder)
 * @param currentId   etapa atual da candidatura
 * @param historyIds  etapas por onde passou, em ordem cronológica (application_stage_history)
 */
export function candidateStageFlow<T extends FlowStage>(
  stages: T[],
  currentId: string,
  historyIds: string[] = []
): CandidateStageFlow {
  const pipeline = pipelineStages(stages);
  const current = stages.find((s) => s.id === currentId) ?? null;
  const idx = pipeline.findIndex((s) => s.id === currentId);
  const lostStage = stages.find((s) => s.kind === "LOST") ?? null;

  let status: CandidateFlowStatus;
  if (current?.kind === "LOST") status = "LOST";
  else if (idx < 0) status = "OFF_PIPELINE";
  else if (idx === pipeline.length - 1 || current?.kind === "WON") status = "FINAL";
  else status = "OPEN";

  let resumeTo: FlowStage | null = null;
  if (status === "LOST" || status === "OFF_PIPELINE") {
    for (let i = historyIds.length - 1; i >= 0; i--) {
      const hit = pipeline.find((s) => s.id === historyIds[i] && s.id !== currentId);
      if (hit) {
        resumeTo = hit;
        break;
      }
    }
    resumeTo ??= pipeline[0] ?? null;
  }

  return {
    current,
    status,
    position: idx >= 0 ? { index: idx + 1, total: pipeline.length } : null,
    next: status === "OPEN" ? pipeline[idx + 1] ?? null : null,
    previous: idx > 0 && (status === "OPEN" || status === "FINAL") ? pipeline[idx - 1] : null,
    resumeTo,
    lost: status === "LOST" ? null : lostStage,
    moveTargets: stages.filter((s) => s.id !== currentId && s.kind !== "LOST"),
  };
}

/**
 * Quando a candidatura entrou na etapa atual: último registro do histórico, desde que
 * seja a própria etapa atual. Se o histórico não bate (dado legado), devolve null — a UI
 * não mostra "Na etapa há …" em vez de chutar.
 */
export function enteredCurrentStageAt(
  history: Array<{ stageId: string | null; changedAt: string }>,
  currentId: string
): string | null {
  const last = history[history.length - 1];
  return last && last.stageId === currentId ? last.changedAt : null;
}
