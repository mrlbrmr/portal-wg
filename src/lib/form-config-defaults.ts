import type { FormConfig } from "@/types/form-config";

// Perguntas COMPLEMENTARES da solicitação de vaga (/solicitar-vaga).
//
// Os campos principais do pedido — título, área, unidade, gestor, quantidade, motivo,
// justificativa, condições da vaga — deixaram de ser configuráveis: viraram colunas da
// tabela `job_requests` com validação própria (src/lib/job-requests/schema.ts), porque a
// solicitação passou a ser um objeto de gestão com filtros, aprovação e histórico.
//
// O editor em /configuracoes/formulario-vaga continua servindo para o RH acrescentar
// perguntas extras (o que for específico da WG e não faz parte do núcleo). As respostas
// vão para `job_requests.extra_data` e aparecem na tela da solicitação.
//
// Por padrão: nenhuma pergunta extra.
export const DEFAULT_FORM_CONFIG: FormConfig = {
  title: "Solicitação de Vaga | WG Baterias",
  description:
    "Preencha sua necessidade de contratação. O time de Gente & Gestão valida a solicitação " +
    "e encaminha para aprovação — a vaga só é aberta depois disso.",
  fields: [],
};
