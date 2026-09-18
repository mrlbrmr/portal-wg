import type { FormConfig } from "@/types/form-config";

// Formulário de Requisição de Pessoal (RP) preenchido pelo gestor em /solicitar-vaga.
// Fallback usado quando ainda não há config salva em `job_request_form_config`
// (o editor em /vagas/configuracoes sobrescreve isto). As keys marcadas abaixo são
// lidas pela API para preencher as colunas da requisição e pré-preencher a vaga —
// renomeá-las no editor faz o mapeamento cair para o texto livre do form_data.
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
      id: "emailGestor",
      key: "emailGestor",
      label: "E-mail do gestor(a)",
      type: "email",
      required: true,
      placeholder: "nome@wgbaterias.com.br",
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
      id: "quantidade",
      key: "quantidade",
      label: "Quantidade de posições",
      type: "number",
      required: true,
      placeholder: "Ex: 1",
    },
    {
      id: "tipoContratacao",
      key: "tipoContratacao",
      label: "Tipo de contratação",
      type: "select",
      required: true,
      options: ["CLT", "Estágio", "Jovem aprendiz", "Temporário", "PJ"],
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
      id: "dataDesligamento",
      key: "dataDesligamento",
      label: "Data de desligamento do colaborador",
      type: "date",
      required: false,
      showWhen: {
        fieldKey: "motivo",
        operator: "is",
        value: "Substituição",
      },
    },
    {
      id: "dataInicio",
      key: "dataInicio",
      label: "Data desejada de início",
      type: "date",
      required: false,
    },
    {
      id: "salarioPretendido",
      key: "salarioPretendido",
      label: "Faixa salarial pretendida",
      type: "text",
      required: false,
      placeholder: 'Ex: R$ 2.500 a R$ 3.000 (ou "a combinar")',
    },
    {
      id: "perfil",
      key: "perfil",
      label: "Perfil do candidato",
      type: "textarea",
      required: false,
      placeholder:
        "Descreva brevemente o perfil ideal: experiências, conhecimentos ou habilidades desejadas.",
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
