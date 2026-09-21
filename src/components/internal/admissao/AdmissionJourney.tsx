import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
}

interface Props {
  /** Etapas configuradas em Admissões → Configurações, na ordem do cadastro. */
  stages: Stage[];
  currentStageId: string | null;
}

/**
 * Jornada da admissão: as etapas REAIS configuradas pelo RH, com a atual destacada.
 * Não inventa etapas — se o RH cadastrar "Exame" ou "Contratação", elas aparecem aqui.
 */
export function AdmissionJourney({ stages, currentStageId }: Props) {
  if (stages.length === 0) return null;
  const currentIdx = stages.findIndex((s) => s.id === currentStageId);

  return (
    <nav aria-label="Jornada da admissão" className="overflow-x-auto">
      <ol className="flex min-w-max items-start">
        {stages.map((s, i) => {
          const state = currentIdx < 0 ? "todo" : i < currentIdx ? "done" : i === currentIdx ? "current" : "todo";
          return (
            <li key={s.id} className="flex items-start" aria-current={state === "current" ? "step" : undefined}>
              <div className="flex w-[104px] flex-col items-center text-center">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[12px] font-semibold tabular-nums",
                    state === "done" && "border-wg-green-dark bg-wg-green-dark text-white",
                    state === "current" && "border-wg-green-dark bg-white text-wg-green-dark ring-4 ring-wg-green/25",
                    state === "todo" && "border-wg-border-light bg-white text-wg-ink-muted"
                  )}
                >
                  {state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                </span>
                <span
                  className={cn(
                    "mt-1.5 px-1 text-[12px] leading-tight",
                    state === "current" ? "font-semibold text-wg-ink" : state === "done" ? "text-wg-ink-secondary" : "text-wg-ink-muted"
                  )}
                >
                  {s.name}
                </span>
                <span className="sr-only">
                  {state === "done" ? "concluída" : state === "current" ? "etapa atual" : "pendente"}
                </span>
              </div>
              {i < stages.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "mt-[13px] h-0.5 w-6 shrink-0 rounded-full",
                    currentIdx >= 0 && i < currentIdx ? "bg-wg-green-dark" : "bg-wg-border-light"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
