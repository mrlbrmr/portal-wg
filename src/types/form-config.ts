// Campos adicionais (perguntas complementares) da solicitação de vaga.
// As respostas ficam em job_requests.extra_data como Record<string, string>:
//  • multiselect → JSON de string[] (ex.: '["Manhã","Tarde"]')
//  • boolean     → "Sim" | "Não"
// Regras (visibilidade, validação, exibição) em src/lib/job-requests/extra-fields.ts.

export type FieldType = "text" | "textarea" | "select" | "multiselect" | "boolean" | "number" | "date" | "email";

export type ConditionOperator = "is" | "is_not";

export interface ShowCondition {
  fieldKey: string;
  operator: ConditionOperator;
  value: string;
}

export interface FormFieldConfig {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  /** Texto de ajuda exibido abaixo do campo. */
  helpText?: string;
  options?: string[];
  showWhen?: ShowCondition; // if set, field is hidden until condition is met
}

export interface FormConfig {
  title: string;
  description: string;
  fields: FormFieldConfig[];
}
