import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_SOFT, type Tone } from "@/components/ui/StatusBadge";

export interface TimelineEvent {
  id: string;
  /** ISO timestamp do evento. */
  at: string;
  /** Frase do que aconteceu, ex.: "Murilo enviou 3 documentos". */
  title: ReactNode;
  /** Detalhe opcional (comentário, motivo, nome do arquivo). */
  description?: ReactNode;
  icon?: ElementType;
  tone?: Tone;
}

interface Props {
  events: TimelineEvent[];
  /** Texto exibido quando não há eventos. */
  emptyText?: string;
  /** Limita a quantidade exibida (ex.: resumo na Visão geral). */
  limit?: number;
  className?: string;
}

const TZ = "America/Sao_Paulo";

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

function dayLabel(key: string, now: Date): string {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const yesterday = new Date(now.getTime() - 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
  if (key === today) return "Hoje";
  if (key === yesterday) return "Ontem";
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/**
 * Linha do tempo reutilizável (vaga, candidato, admissão). Agrupa por dia ("Hoje",
 * "Ontem", data) em ordem decrescente. Só recebe eventos reais — nunca simule histórico.
 */
export function ActivityTimeline({ events, emptyText = "Nenhuma atividade registrada ainda.", limit, className }: Props) {
  if (events.length === 0) {
    return <p className={cn("text-body text-wg-ink-muted", className)}>{emptyText}</p>;
  }

  const now = new Date();
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit ?? events.length);
  const groups: Array<{ key: string; items: TimelineEvent[] }> = [];
  for (const e of sorted) {
    const key = dayKey(e.at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(e);
    else groups.push({ key, items: [e] });
  }

  return (
    <div className={cn("space-y-5", className)}>
      {groups.map((g) => (
        <section key={g.key} aria-label={dayLabel(g.key, now)}>
          <h4 className="mb-2 font-inter text-label uppercase tracking-wide text-wg-ink-muted">
            {dayLabel(g.key, now)}
          </h4>
          <ol className="relative space-y-3 pl-9">
            <span aria-hidden className="absolute bottom-2 left-[13px] top-2 w-px bg-wg-border-lighter" />
            {g.items.map((e) => {
              const Icon = e.icon;
              return (
                <li key={e.id} className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-9 top-0 flex h-[27px] w-[27px] items-center justify-center rounded-full ring-4 ring-white",
                      TONE_SOFT[e.tone ?? "neutral"]
                    )}
                  >
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <p className="text-body text-wg-ink">
                    <time dateTime={e.at} className="mr-2 text-meta tabular-nums text-wg-ink-muted">
                      {timeLabel(e.at)}
                    </time>
                    {e.title}
                  </p>
                  {e.description && <div className="mt-1 text-meta text-wg-ink-muted">{e.description}</div>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
