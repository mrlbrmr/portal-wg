"use client";

import { ArrowRight, Inbox, UserX } from "lucide-react";
import { ActivityTimeline, type TimelineEvent } from "@/components/ui/ActivityTimeline";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import type { CandidateDetail } from "./types";

/**
 * Eventos REAIS da candidatura: a criação (createdAt) e cada troca de etapa registrada em
 * application_stage_history (com autor e data). Visualizações de currículo e edições de
 * nota não são registradas pelo sistema — não aparecem.
 */
export function candidateEvents(data: CandidateDetail, lostStageId: string | null): TimelineEvent[] {
  const source = APPLICATION_SOURCE_LABELS[data.source] ?? data.source;
  const events: TimelineEvent[] = [];
  const history = data.stageHistory;
  const createdMs = new Date(data.createdAt).getTime();

  // O 1º registro do histórico costuma ser a própria entrada ("Novas candidaturas").
  const firstIsIntake =
    history.length > 0 && Math.abs(new Date(history[0].changedAt).getTime() - createdMs) < 5 * 60_000;

  events.push({
    id: "created",
    at: firstIsIntake ? history[0].changedAt : data.createdAt,
    title: `Candidatura recebida via ${source}`,
    description: data.addedBy
      ? `Cadastrada por ${data.addedBy}`
      : firstIsIntake && history[0].changedBy && !/candidato/i.test(history[0].changedBy)
      ? `Por ${history[0].changedBy}`
      : undefined,
    icon: Inbox,
    tone: "info",
  });

  history.forEach((h, i) => {
    if (i === 0 && firstIsIntake) return;
    const name = h.stage?.name ?? "etapa removida";
    const rejected = lostStageId !== null && h.stageId === lostStageId;
    events.push({
      id: h.id,
      at: h.changedAt,
      title: rejected ? (
        <>Candidatura reprovada</>
      ) : (
        <>
          Movido para <strong className="font-semibold">{name}</strong>
        </>
      ),
      description: `Por ${h.changedBy}`,
      icon: rejected ? UserX : ArrowRight,
      tone: rejected ? "danger" : "success",
    });
  });

  return events;
}

export function CandidateHistory({ data, lostStageId }: { data: CandidateDetail; lostStageId: string | null }) {
  const events = candidateEvents(data, lostStageId);
  return (
    <div>
      <ActivityTimeline events={events} />
      {events.length <= 1 && (
        <p className="mt-4 border-t border-wg-border-lighter pt-4 text-meta text-wg-ink-muted">
          Ainda não há atividades adicionais registradas.
        </p>
      )}
    </div>
  );
}
