// Remuneração da vaga — módulo PURO.
//
// Separa duas perguntas que o formulário antigo misturava num único "Ocultar / A combinar":
//   1. Qual é o salário?          → valor definido (jobs.salary)  ou  a combinar
//   2. O portal divulga o salário? → jobs.salaryPublic
//
// O portal, os feeds (Google/Indeed) e a divulgação leem SÓ jobs.salaryRange (texto). Por
// isso salaryRange passa a ser DERIVADO daqui: é o texto público — ou null quando não se
// divulga. Vagas antigas com texto livre ("R$ 2.500 – R$ 3.000") continuam válidas.

export type SalaryMode = "DEFINED" | "TO_AGREE";

export const TO_AGREE_TEXT = "A combinar";

export interface SalaryState {
  mode: SalaryMode;
  /** Valor interno (R$). null = não informado. */
  salary: number | null;
  /** Divulgar no portal? */
  salaryPublic: boolean;
  /** Texto livre de vaga antiga (sem valor numérico), preservado se nada for informado. */
  legacyText: string | null;
}

export interface SalaryColumns {
  salary: number | null;
  salaryPublic: boolean;
  salaryRange: string | null;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value)
    .replace(/ /g, " ");
}

/** Estado do formulário a partir das colunas gravadas (inclui vagas antigas). */
export function salaryStateFromJob(job: {
  salary: number | string | null;
  salaryRange: string | null;
  salaryPublic?: boolean | null;
}): SalaryState {
  const salary = job.salary == null || job.salary === "" ? null : Number(job.salary);
  const salaryPublic = job.salaryPublic ?? true;
  const text = job.salaryRange?.trim() || null;
  if (salary != null && !Number.isNaN(salary)) return { mode: "DEFINED", salary, salaryPublic, legacyText: null };
  if (text && text.toLowerCase() === TO_AGREE_TEXT.toLowerCase()) {
    return { mode: "TO_AGREE", salary: null, salaryPublic, legacyText: null };
  }
  return { mode: "DEFINED", salary: null, salaryPublic, legacyText: text };
}

/** Colunas a gravar a partir do que o RH escolheu. */
export function salaryColumns(state: SalaryState): SalaryColumns {
  if (state.mode === "TO_AGREE") {
    return { salary: null, salaryPublic: state.salaryPublic, salaryRange: state.salaryPublic ? TO_AGREE_TEXT : null };
  }
  if (state.salary != null && state.salary > 0) {
    return {
      salary: state.salary,
      salaryPublic: state.salaryPublic,
      salaryRange: state.salaryPublic ? formatBRL(state.salary) : null,
    };
  }
  // Sem valor: preserva o texto antigo (se houver) enquanto for público.
  return { salary: null, salaryPublic: state.salaryPublic, salaryRange: state.salaryPublic ? state.legacyText : null };
}

/** Como o salário aparece para o candidato — útil no resumo interno. */
export function publicSalaryLabel(cols: Pick<SalaryColumns, "salaryRange">): string {
  return cols.salaryRange ?? "Não divulgado";
}

/** Como o RH lê o salário interno. */
export function internalSalaryLabel(state: SalaryState): string {
  if (state.mode === "TO_AGREE") return TO_AGREE_TEXT;
  if (state.salary != null) return formatBRL(state.salary);
  return state.legacyText ?? "Não informado";
}
