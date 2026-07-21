export type FieldType = "text" | "textarea" | "select";

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
  options?: string[];
  showWhen?: ShowCondition; // if set, field is hidden until condition is met
}

export interface FormConfig {
  title: string;
  description: string;
  fields: FormFieldConfig[];
}
