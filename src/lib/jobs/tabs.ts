// Abas da página da vaga (/vagas/[id]/editar?tab=…). Módulo neutro: lido pela página
// (servidor, para o deep-link) e pelo workspace (cliente).

export const JOB_TABS = [
  { id: "visao", label: "Visão geral" },
  { id: "descricao", label: "Descrição" },
  { id: "processo", label: "Processo seletivo" },
  { id: "divulgacao", label: "Divulgação" },
  { id: "historico", label: "Histórico" },
] as const;

export type JobTab = (typeof JOB_TABS)[number]["id"];

export function isJobTab(v: unknown): v is JobTab {
  return JOB_TABS.some((t) => t.id === v);
}
