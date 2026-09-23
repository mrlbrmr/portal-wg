"use client";

import { useState } from "react";
import { ArrowRight, Lock, Pencil, Plus, Workflow, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { settingsSelectClass } from "@/components/internal/settings/fields";
import { CONDITION_TYPES, type ConditionType, type FormConfig } from "@/lib/admissao/form-config";
import { conditionAnswer, conditionQuestion } from "./shared";
import { buildCondition } from "./DocumentsTab";

type Setter = (fn: (c: FormConfig) => FormConfig) => void;
type RuleQuestion = Exclude<ConditionType, "always">;

const RULE_QUESTIONS = CONDITION_TYPES.filter((t): t is RuleQuestion => t !== "always");

function Rule({ when, is, then, children }: { when: string; is: string; then: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-3 text-meta">
      <span className="rounded bg-wg-bg px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-wg-ink-muted">SE</span>
      <span className="font-medium text-wg-ink">{when}</span>
      <span className="text-wg-ink-muted">=</span>
      <span className="rounded-full bg-info-bg px-2 py-0.5 text-[12px] font-semibold text-info-fg">{is}</span>
      <ArrowRight className="h-3.5 w-3.5 text-wg-ink-muted" aria-label="então" />
      <span className="text-wg-ink-secondary">{then}</span>
      {children && <span className="ml-auto flex items-center gap-1">{children}</span>}
    </li>
  );
}

/**
 * Aba "Regras": o que aparece conforme as respostas do candidato. Usa o motor de
 * condições que já existia (DocCondition em lib/admissao/form-config.ts) — as regras
 * de documentos são editáveis; as demais são fixas do formulário.
 */
export function RulesTab({
  config,
  set,
  onEditDocument,
}: {
  config: FormConfig;
  set: Setter;
  onEditDocument: (key: string) => void;
}) {
  const [question, setQuestion] = useState<RuleQuestion>("marital");
  const [values, setValues] = useState<string[]>([]);
  const [docKey, setDocKey] = useState(config.documents[0]?.key ?? "");

  const conditional = config.documents.filter((d) => d.condition.type !== "always");
  const target = config.documents.find((d) => d.key === docKey);
  const valueOptions = question === "gender" ? config.genderOptions : question === "marital" ? config.maritalOptions : [];
  const needsValues = question === "gender" || question === "marital";
  const canAdd = !!target && (!needsValues || values.length > 0);

  function addRule() {
    if (!target) return;
    set((c) => ({
      ...c,
      documents: c.documents.map((d) => (d.key === target.key ? { ...d, condition: buildCondition(question, values) } : d)),
    }));
    setValues([]);
  }

  const fixedRules = [
    { when: config.labels.needsTransportVoucher, is: "Sim", then: `mostrar a pergunta “${config.labels.transportVoucherDetails}”` },
    { when: config.labels.hasItauAccount, is: "Sim", then: "pedir agência e conta" },
    { when: config.labels.hasItauAccount, is: "Não", then: "mostrar a orientação sobre conta Itaú" },
    { when: config.labels.isDriverOperator, is: "Sim", then: "mostrar a orientação para Motorista/Operador" },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-wg-border-lighter bg-white" aria-labelledby="rules-docs-title">
        <header className="px-5 pb-3 pt-4">
          <h2 id="rules-docs-title" className="font-sora text-section-title text-wg-ink">
            Documentos condicionais
          </h2>
          <p className="mt-0.5 text-meta text-wg-ink-muted">
            Documentos pedidos só quando a resposta do candidato combina com a regra.
          </p>
        </header>

        {conditional.length === 0 ? (
          <EmptyState
            compact
            icon={Workflow}
            title="Nenhuma regra de documento"
            description="Todos os documentos são pedidos sempre. Crie uma regra abaixo para pedir um documento só em certos casos."
            className="border-t border-wg-border-lighter"
          />
        ) : (
          <ul className="divide-y divide-wg-border-lighter border-t border-wg-border-lighter">
            {conditional.map((d) => {
              const c = d.condition;
              if (c.type === "always") return null;
              return (
                <Rule
                  key={d.key}
                  when={conditionQuestion(c.type, config)}
                  is={conditionAnswer(c)}
                  then={`pedir “${d.label}” (${d.required ? "obrigatório" : "opcional"})`}
                >
                  <Button variant="tertiary" size="sm" icon={Pencil} onClick={() => onEditDocument(d.key)}>
                    Editar
                  </Button>
                  <Button
                    variant="tertiary"
                    size="sm"
                    icon={X}
                    title="O documento passa a ser pedido sempre"
                    onClick={() =>
                      set((cfg) => ({
                        ...cfg,
                        documents: cfg.documents.map((x) => (x.key === d.key ? { ...x, condition: { type: "always" } } : x)),
                      }))
                    }
                  >
                    Remover regra
                  </Button>
                </Rule>
              );
            })}
          </ul>
        )}

        {/* Nova regra */}
        <div className="border-t border-wg-border-lighter bg-wg-bg/50 px-5 py-4">
          <p className="mb-2 text-label font-semibold text-wg-ink-secondary">Nova regra</p>
          <div className="flex flex-wrap items-center gap-2 text-meta text-wg-ink-secondary">
            <span className="font-bold text-wg-ink-muted">SE</span>
            <label htmlFor="rule-question" className="sr-only">
              Pergunta
            </label>
            <select
              id="rule-question"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value as RuleQuestion);
                setValues([]);
              }}
              className={cn(settingsSelectClass, "w-auto max-w-[280px] py-1.5")}
            >
              {RULE_QUESTIONS.map((q) => (
                <option key={q} value={q}>
                  {conditionQuestion(q, config)}
                </option>
              ))}
            </select>
            <span>=</span>
            {needsValues ? (
              <span className="flex flex-wrap gap-1.5" role="group" aria-label="Respostas">
                {valueOptions.map((v) => {
                  const on = values.includes(v);
                  return (
                    <label
                      key={v}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] transition-colors",
                        on ? "border-wg-green bg-wg-green/15 font-medium text-wg-green-dark" : "border-wg-border-light bg-white hover:border-wg-green/60"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setValues((cur) => (on ? cur.filter((x) => x !== v) : [...cur, v]))}
                        className="h-3 w-3 accent-wg-green"
                      />
                      {v}
                    </label>
                  );
                })}
              </span>
            ) : (
              <span className="rounded-full bg-info-bg px-2 py-0.5 text-[12px] font-semibold text-info-fg">Sim</span>
            )}
            <span className="font-bold text-wg-ink-muted">ENTÃO pedir</span>
            <label htmlFor="rule-doc" className="sr-only">
              Documento
            </label>
            <select
              id="rule-doc"
              value={docKey}
              onChange={(e) => setDocKey(e.target.value)}
              className={cn(settingsSelectClass, "w-auto max-w-[280px] py-1.5")}
            >
              {config.documents.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" icon={Plus} onClick={addRule} disabled={!canAdd}>
              Adicionar regra
            </Button>
          </div>
          {target && target.condition.type !== "always" && (
            <p className="mt-2 text-label font-normal text-warning-fg">
              “{target.label}” já tem uma regra — ela será substituída.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-card border border-wg-border-lighter bg-white" aria-labelledby="rules-fixed-title">
        <header className="px-5 pb-3 pt-4">
          <h2 id="rules-fixed-title" className="flex items-center gap-2 font-sora text-section-title text-wg-ink">
            Regras fixas do formulário
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-meta text-wg-ink-muted">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Fazem parte da estrutura do formulário. Os textos podem ser ajustados nas
            abas Perguntas e Conteúdo.
          </p>
        </header>
        <ul className="divide-y divide-wg-border-lighter border-t border-wg-border-lighter">
          {fixedRules.map((r) => (
            <Rule key={r.then} when={r.when} is={r.is} then={r.then} />
          ))}
        </ul>
      </section>
    </div>
  );
}
