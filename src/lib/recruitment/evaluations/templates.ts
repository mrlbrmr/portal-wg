// Modelos de parecer — módulo PURO. Um modelo é só a estrutura de seções que entra no
// editor (título H3 + parágrafo vazio para escrever). Para um modelo novo, acrescente um
// item em REPORT_TEMPLATES; não há cadastro de modelos nesta fase.

import type { ReportDoc, ReportNode } from "./document";

export interface ReportTemplate {
  id: string;
  label: string;
  description: string;
  sections: string[];
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "complete",
    label: "Parecer completo",
    description: "Perfil, trajetória, critérios, teste, condições e recomendação.",
    sections: [
      "Síntese do perfil",
      "Trajetória profissional",
      "Avaliação por critério",
      "Teste comportamental",
      "Remuneração, jornada e logística",
      "Pontos fortes",
      "Pontos de atenção",
      "Recomendação e próximos passos",
    ],
  },
  {
    id: "simple",
    label: "Parecer simplificado",
    description: "Síntese, pontos fortes, pontos de atenção e parecer final.",
    sections: ["Síntese", "Pontos fortes", "Pontos de atenção", "Parecer final"],
  },
  {
    id: "blank",
    label: "Em branco",
    description: "Começar com o editor vazio.",
    sections: [],
  },
];

export function findTemplate(id: string): ReportTemplate | null {
  return REPORT_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Documento do editor para o modelo. "Em branco" = um parágrafo vazio. */
export function templateDoc(template: ReportTemplate): ReportDoc {
  if (template.sections.length === 0) return { type: "doc", content: [{ type: "paragraph" }] };
  const content: ReportNode[] = [];
  for (const title of template.sections) {
    content.push({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: title }] });
    content.push({ type: "paragraph" });
  }
  return { type: "doc", content };
}
