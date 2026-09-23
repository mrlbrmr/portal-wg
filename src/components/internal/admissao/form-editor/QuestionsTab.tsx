"use client";

import { ChevronDown, Lock, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { settingsInputClass } from "@/components/internal/settings/fields";
import type { FormConfig } from "@/lib/admissao/form-config";
import { StringListEditor } from "./shared";

type Setter = (fn: (c: FormConfig) => FormConfig) => void;
type LabelKey = keyof FormConfig["labels"];
type OptionsKey = "genderOptions" | "maritalOptions" | "colorOptions";

interface QuestionDef {
  id: string;
  type: "Escolha única" | "Sim / Não" | "Texto longo";
  labelKey?: LabelKey;
  fixedLabel?: string;
  optionsKey?: OptionsKey;
  note?: (c: FormConfig) => string;
}

// Espelha as perguntas de src/app/admissao/[token]/DigitalForm.tsx (passos 1 e 2).
// O TIPO e a ordem são estruturais — as respostas viram colunas da admissão.
const QUESTIONS: QuestionDef[] = [
  { id: "gender", type: "Escolha única", fixedLabel: "Gênero", optionsKey: "genderOptions" },
  { id: "marital", type: "Escolha única", labelKey: "maritalStatus", optionsKey: "maritalOptions" },
  { id: "children", type: "Sim / Não", labelKey: "hasChildren" },
  { id: "vt", type: "Sim / Não", labelKey: "needsTransportVoucher" },
  {
    id: "vt-details",
    type: "Texto longo",
    labelKey: "transportVoucherDetails",
    note: (c) => `Aparece quando “${c.labels.needsTransportVoucher}” = Sim.`,
  },
  {
    id: "itau",
    type: "Sim / Não",
    labelKey: "hasItauAccount",
    note: () => "Se a resposta for Sim, o formulário pede agência e conta.",
  },
  { id: "color", type: "Escolha única", labelKey: "colorDeclaration", optionsKey: "colorOptions" },
  { id: "driver", type: "Sim / Não", labelKey: "isDriverOperator" },
];

const FIXED_FIELDS = [
  "Nome completo",
  "CPF",
  "Data de nascimento",
  "E-mail",
  "Telefone / WhatsApp",
  "Tamanho da camiseta",
  "Tamanho da calça e número da bota (quando usa uniforme operacional)",
];

/** Aba "Perguntas": rótulos e opções das perguntas do formulário do candidato. */
export function QuestionsTab({ config, set }: { config: FormConfig; set: Setter }) {
  const [fixedOpen, setFixedOpen] = useState(false);

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-meta text-wg-ink-muted">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        O tipo e a ordem das perguntas são fixos, porque as respostas alimentam a ficha da admissão. Você pode ajustar
        os textos e as opções de resposta. Todas as perguntas são obrigatórias para o candidato.
      </p>

      <ol className="space-y-3">
        {QUESTIONS.map((q, i) => {
          const inputId = `adm-q-${q.id}`;
          const label = q.labelKey ? config.labels[q.labelKey] : q.fixedLabel!;
          return (
            <li key={q.id} className="rounded-card border border-wg-border-lighter bg-white p-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-wg-sidebar text-label font-semibold text-wg-green-dark">
                      {i + 1}
                    </span>
                    <span className="rounded-full border border-wg-border-light bg-wg-bg px-2 py-0.5 text-[11px] font-semibold text-wg-ink-secondary">
                      {q.type}
                    </span>
                    <span className="text-label text-wg-ink-muted">Obrigatória</span>
                  </div>
                  {q.labelKey ? (
                    <>
                      <label htmlFor={inputId} className="mb-1.5 block text-label font-semibold text-wg-ink-secondary">
                        Texto da pergunta
                      </label>
                      <input
                        id={inputId}
                        maxLength={200}
                        value={label}
                        onChange={(e) =>
                          set((c) => ({ ...c, labels: { ...c.labels, [q.labelKey!]: e.target.value } }))
                        }
                        className={settingsInputClass}
                      />
                    </>
                  ) : (
                    <p className="text-body font-semibold text-wg-ink">
                      {label}
                      <span className="ml-2 inline-flex items-center gap-1 text-label font-normal text-wg-ink-muted">
                        <Lock className="h-3 w-3" aria-hidden /> texto fixo
                      </span>
                    </p>
                  )}
                  {q.note && (
                    <p className="mt-2 flex items-center gap-1.5 text-label font-normal text-wg-ink-muted">
                      <Zap className="h-3 w-3 text-warning" aria-hidden /> {q.note(config)}
                    </p>
                  )}
                </div>
                {q.optionsKey ? (
                  <fieldset>
                    <legend className="mb-1.5 text-label font-semibold text-wg-ink-secondary">Opções de resposta</legend>
                    <StringListEditor
                      id={`${inputId}-opts`}
                      values={config[q.optionsKey]}
                      onChange={(v) => set((c) => ({ ...c, [q.optionsKey!]: v }))}
                    />
                  </fieldset>
                ) : q.type === "Sim / Não" ? (
                  <div>
                    <p className="mb-1.5 text-label font-semibold text-wg-ink-secondary">Respostas</p>
                    <div className="flex gap-2" aria-hidden>
                      {["Sim", "Não"].map((o) => (
                        <span key={o} className="rounded-control border border-wg-border-light bg-wg-bg px-3 py-1.5 text-meta text-wg-ink-muted">
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <section className="rounded-card border border-wg-border-lighter bg-white">
        <button
          type="button"
          onClick={() => setFixedOpen((o) => !o)}
          aria-expanded={fixedOpen}
          aria-controls="adm-fixed-fields"
          className="flex w-full items-center justify-between gap-3 rounded-card px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
        >
          <span className="flex items-center gap-2 text-body font-semibold text-wg-ink">
            <Lock className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
            Dados pessoais e uniforme
            <span className="text-meta font-normal text-wg-ink-muted">{FIXED_FIELDS.length} campos fixos</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-wg-ink-muted transition-transform", fixedOpen && "rotate-180")} aria-hidden />
        </button>
        {fixedOpen && (
          <ul id="adm-fixed-fields" className="divide-y divide-wg-border-lighter border-t border-wg-border-lighter">
            {FIXED_FIELDS.map((f) => (
              <li key={f} className="flex items-center justify-between gap-3 px-4 py-2 text-meta text-wg-ink-secondary">
                {f}
                <span className="text-label text-wg-ink-muted">Campo estrutural</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
