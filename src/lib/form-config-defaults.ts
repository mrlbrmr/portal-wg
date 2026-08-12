import type { FormConfig } from "@/types/form-config";

export const DEFAULT_FORM_CONFIG: FormConfig = {
  title: "Abertura de Vaga | WG Baterias",
  description:
    "Em caso de dúvidas no preenchimento do formulário entrar em contato com o time de Gente & Gestão!",
  fields: [
    {
      id: "gestor",
      key: "gestor",
      label: "Gestor(a)",
      type: "text",
      required: true,
      placeholder: "Nome completo do gestor(a)",
    },
    {
      id: "funcao",
      key: "funcao",
      label: "Função",
      type: "text",
      required: true,
      placeholder: "Ex: Auxiliar de Estoque, Vendedor(a)...",
    },
    {
      id: "horario",
      key: "horario",
      label: "Horário de trabalho",
      type: "text",
      required: true,
      placeholder: "Ex: Seg a Sex, 08h–17h",
    },
    {
      id: "local",
      key: "local",
      label: "Local de trabalho",
      type: "select",
      required: true,
      options: [],
    },
    {
      id: "motivo",
      key: "motivo",
      label: "Motivo da abertura",
      type: "select",
      required: true,
      options: [
        "Substituição",
        "Expansão de equipe",
        "Nova posição",
        "Cobertura temporária",
        "Outro",
      ],
    },
    {
      id: "colaboradorSubstituido",
      key: "colaboradorSubstituido",
      label: "Nome do colaborador substituído",
      type: "text",
      required: false,
      placeholder: "Nome completo do colaborador que está saindo",
      showWhen: {
        fieldKey: "motivo",
        operator: "is",
        value: "Substituição",
      },
    },
    {
      id: "perfil",
      key: "perfil",
      label: "Perfil do candidato",
      type: "textarea",
      required: false,
      placeholder: "Descreva brevemente o perfil ideal: experiências, conhecimentos ou habilidades desejadas.",
    },
    {
      id: "observacoes",
      key: "observacoes",
      label: "Outras informações",
      type: "textarea",
      required: false,
      placeholder: "Qualquer detalhe adicional sobre a vaga (opcional).",
    },
  ],
};
