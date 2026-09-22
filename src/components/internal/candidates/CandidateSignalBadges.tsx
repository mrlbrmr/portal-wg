import { Brain, CalendarClock, Clock, FileWarning, FlaskConical } from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { TONE_SOFT } from "@/components/ui/StatusBadge";
import type { CandidateSignal, SignalIcon } from "@/lib/recruitment/candidate-presentation";

const ICONS: Record<SignalIcon, ElementType> = {
  test: FlaskConical,
  calendar: CalendarClock,
  clock: Clock,
  file: FileWarning,
  brain: Brain,
};

interface Props {
  signals: CandidateSignal[];
  /** Quantos mostrar; o restante vira "+N" com a lista no tooltip. */
  max?: number;
  className?: string;
}

/**
 * Badges operacionais do candidato (teste pendente, entrevista, etapa parada…). Pequenos,
 * em tom suave e sempre com ícone + texto — nunca só cor. A ordem vem de candidateSignals.
 */
export function CandidateSignalBadges({ signals, max = 2, className }: Props) {
  if (signals.length === 0) return null;
  const shown = signals.slice(0, max);
  const rest = signals.slice(max);

  return (
    <ul className={cn("flex flex-wrap items-center gap-1", className)} aria-label="Sinais do candidato">
      {shown.map((s) => {
        const Icon = ICONS[s.icon];
        return (
          <li
            key={s.key}
            title={s.hint}
            className={cn(
              "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-1.5 text-[11px] font-medium",
              TONE_SOFT[s.tone]
            )}
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden />
            {s.label}
            {s.hint && <span className="sr-only">. {s.hint}</span>}
          </li>
        );
      })}
      {rest.length > 0 && (
        <li
          title={rest.map((s) => s.label).join(" · ")}
          className="inline-flex h-5 items-center rounded-full bg-neutral-bg px-1.5 text-[11px] font-medium text-neutral-fg"
        >
          +{rest.length}
          <span className="sr-only">: {rest.map((s) => s.label).join(", ")}</span>
        </li>
      )}
    </ul>
  );
}
