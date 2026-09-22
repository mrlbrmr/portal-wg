"use client";

import type { ElementType } from "react";
import {
  ArrowRightLeft,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Inbox,
  MessageSquareText,
  Phone,
  Send,
  Sparkles,
  UserRoundCog,
  UserX,
} from "lucide-react";
import { TONE_SOFT, type Tone } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { groupEventsByDay, type CandidateEvent, type CandidateEventType } from "@/lib/recruitment/candidate-timeline";

/** Ícone e tom por tipo — inclui tipos ainda sem fonte de dados (contato, responsável). */
const EVENT_STYLE: Record<CandidateEventType, { icon: ElementType; tone: Tone }> = {
  APPLICATION_RECEIVED: { icon: Inbox, tone: "info" },
  STAGE_CHANGED: { icon: ArrowRightLeft, tone: "success" },
  REJECTED: { icon: UserX, tone: "danger" },
  CONTACT_MADE: { icon: Phone, tone: "neutral" },
  TEST_SENT: { icon: Send, tone: "neutral" },
  TEST_COMPLETED: { icon: ClipboardCheck, tone: "success" },
  ASSESSMENT_CREATED: { icon: ClipboardList, tone: "neutral" },
  AI_ANALYSIS: { icon: Sparkles, tone: "neutral" },
  NOTE_ADDED: { icon: MessageSquareText, tone: "neutral" },
  INTERVIEW_SCHEDULED: { icon: CalendarClock, tone: "info" },
  OWNER_CHANGED: { icon: UserRoundCog, tone: "neutral" },
};

const TZ = "America/Sao_Paulo";
const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/**
 * Histórico denso, agrupado por dia (Hoje, Ontem, 21 de set.): hora à esquerda, ícone do
 * tipo, o que aconteceu, o detalhe (origem → destino) e quem fez.
 */
export function CandidateTimeline({ events, loadingExtras }: { events: CandidateEvent[]; loadingExtras: boolean }) {
  const groups = groupEventsByDay(events);
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-wg-ink-muted">{g.label}</h3>
          <ol className="relative">
            {g.items.map((e, i) => {
              const style = EVENT_STYLE[e.type];
              const Icon = style.icon;
              const last = i === g.items.length - 1;
              return (
                <li key={e.id} className="relative grid grid-cols-[40px_24px_minmax(0,1fr)] gap-x-2.5 pb-2.5">
                  <time dateTime={e.at} className="pt-[3px] text-right text-[12px] tabular-nums text-wg-ink-muted">
                    {time(e.at)}
                  </time>
                  <span className="relative flex justify-center">
                    {!last && <span aria-hidden className="absolute bottom-[-10px] top-6 w-px bg-wg-border-lighter" />}
                    <span
                      aria-hidden
                      className={cn("relative flex h-6 w-6 items-center justify-center rounded-full", TONE_SOFT[style.tone])}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                  </span>
                  <div className="min-w-0 pt-[2px]">
                    <p className="text-body font-medium leading-5 text-wg-ink">{e.title}</p>
                    {e.detail && <p className="break-words text-meta text-wg-ink-secondary">{e.detail}</p>}
                    {e.actor && <p className="text-[12px] text-wg-ink-muted">{e.actor}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <p className="border-t border-wg-border-lighter pt-3 text-[12px] text-wg-ink-muted" aria-live="polite">
        {loadingExtras
          ? "Carregando avaliações, testes e anotações…"
          : "Mostra movimentações de etapa, avaliações, testes e anotações registrados no sistema."}
      </p>
    </div>
  );
}
