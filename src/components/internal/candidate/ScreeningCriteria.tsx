"use client";

import { CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section } from "./Section";

export type CriterionVerdict = "MEETS" | "DOES_NOT_MEET" | "NOT_EVALUATED";

const VERDICTS: Array<{ value: CriterionVerdict; label: string; active: string }> = [
  { value: "MEETS", label: "Atende", active: "bg-success-bg text-success-fg border-success-border" },
  { value: "DOES_NOT_MEET", label: "Não atende", active: "bg-danger-bg text-danger-fg border-danger-border" },
  { value: "NOT_EVALUATED", label: "Não avaliado", active: "bg-neutral-bg text-neutral-fg border-neutral-border" },
];

interface Props {
  /** Requisitos obrigatórios reais da vaga. */
  criteria: string[];
  /**
   * Avaliação por critério. Hoje NÃO há persistência (sem tabela no banco): enquanto
   * `onEvaluate` não for passado, a seção mostra os requisitos como referência de leitura
   * — nada de botão que não salva. Quando existir backend, basta passar os dois props.
   */
  verdicts?: Record<string, CriterionVerdict>;
  onEvaluate?: (criterion: string, verdict: CriterionVerdict) => void;
}

/** "Triagem": critérios explícitos da vaga. Sem score, sem nota automática. */
export function ScreeningCriteria({ criteria, verdicts, onEvaluate }: Props) {
  return (
    <Section
      title="Triagem"
      meta={criteria.length > 0 && <span className="text-meta font-normal text-wg-ink-muted">Requisitos obrigatórios da vaga</span>}
    >
      {criteria.length === 0 ? (
        <p className="text-body text-wg-ink-muted">
          A vaga não tem requisitos obrigatórios em lista. Cadastre-os na descrição da vaga (seção “Requisitos
          obrigatórios”) para usá-los na triagem.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-wg-border-lighter/70">
            {criteria.map((c) => {
              const current = verdicts?.[c] ?? "NOT_EVALUATED";
              return (
                <li key={c} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                  <span className="flex min-w-0 flex-1 items-start gap-2 text-body text-wg-ink">
                    <CircleDashed className="mt-[3px] h-3.5 w-3.5 shrink-0 text-wg-ink-muted" aria-hidden />
                    {c}
                  </span>
                  {onEvaluate && (
                    <div role="radiogroup" aria-label={`Avaliação: ${c}`} className="flex gap-1">
                      {VERDICTS.map((v) => (
                        <button
                          key={v.value}
                          type="button"
                          role="radio"
                          aria-checked={current === v.value}
                          onClick={() => onEvaluate(c, v.value)}
                          className={cn(
                            "h-7 rounded-control border px-2 text-[12px] font-medium transition-colors",
                            current === v.value
                              ? v.active
                              : "border-wg-border-light bg-white text-wg-ink-muted hover:bg-wg-bg"
                          )}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {!onEvaluate && (
            <p className="mt-2 text-meta text-wg-ink-muted">
              Use como roteiro da triagem. O registro de “Atende / Não atende” por requisito ainda não está disponível —
              registre a conclusão nas anotações.
            </p>
          )}
        </>
      )}
    </Section>
  );
}
