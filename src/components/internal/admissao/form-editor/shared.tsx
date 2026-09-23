"use client";

import { Plus, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { settingsInputClass } from "@/components/internal/settings/fields";
import { CONDITION_LABELS, type DocCondition, type FormConfig } from "@/lib/admissao/form-config";

/** Pergunta do formulário que cada tipo de condição consulta. */
export function conditionQuestion(type: Exclude<DocCondition["type"], "always">, config: FormConfig): string {
  switch (type) {
    case "gender":
      return "Gênero";
    case "marital":
      return config.labels.maritalStatus;
    case "hasChildren":
      return config.labels.hasChildren;
    case "hasItauAccount":
      return config.labels.hasItauAccount;
    case "isDriverOperator":
      return config.labels.isDriverOperator;
  }
}

/** Resposta que dispara a condição ("Casado(a) ou União Estável", "Sim"). */
export function conditionAnswer(cond: DocCondition): string {
  if (cond.type === "gender" || cond.type === "marital") {
    return cond.values.length ? cond.values.join(" ou ") : "(nenhuma opção marcada)";
  }
  return "Sim";
}

/** "Sempre" ou "Se Estado civil = Casado(a)". */
export function describeCondition(cond: DocCondition, config: FormConfig): string {
  if (cond.type === "always") return CONDITION_LABELS.always;
  return `Se “${conditionQuestion(cond.type, config)}” = ${conditionAnswer(cond)}`;
}

/** Lista editável de opções de resposta (gênero, estado civil, cor…). */
export function StringListEditor({
  id,
  values,
  onChange,
  addLabel = "Adicionar opção",
}: {
  id: string;
  values: string[];
  onChange: (v: string[]) => void;
  addLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <label htmlFor={`${id}-${i}`} className="sr-only">
            Opção {i + 1}
          </label>
          <input
            id={`${id}-${i}`}
            className={cn(settingsInputClass, "py-1.5")}
            value={v}
            maxLength={60}
            aria-invalid={!v.trim()}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            disabled={values.length <= 1}
            aria-label={`Remover opção ${v || i + 1}`}
            title={values.length <= 1 ? "Mantenha ao menos uma opção" : "Remover opção"}
            className={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
          >
            <X aria-hidden />
          </button>
        </div>
      ))}
      <Button variant="tertiary" size="sm" icon={Plus} onClick={() => onChange([...values, ""])}>
        {addLabel}
      </Button>
    </div>
  );
}
