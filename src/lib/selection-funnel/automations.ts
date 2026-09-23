// Automações das etapas do funil de seleção — ações executadas quando um candidato
// ENTRA na etapa. Módulo PURO: a tela de configuração, o pipeline (cliente) e a API
// (servidor) consultam as mesmas regras.
//
// Só entra aqui o que o sistema realmente executa. Hoje:
//  • openAdmission  → etapas Admissão/Contratado abrem o cadastro da admissão
//                     (comportamento que já existia, agora configurável; padrão: ligado).
//  • createTestLink → etapas Teste geram o link do teste vinculado no servidor
//                     (padrão: desligado). O envio ao candidato continua manual —
//                     o sistema ainda não envia e-mail de teste.

export type StageKind = "OPEN" | "WON" | "LOST" | "TEST" | "ADMISSION";

/**
 * Etapa de ENTRADA do funil: as rotas de candidatura gravam `stageId: "NEW"` fixo
 * (api/applications, vagas/[id]/candidatos, from-talento). Não pode sair do quadro.
 */
export const ENTRY_STAGE_ID = "NEW";

export const STAGE_KINDS: StageKind[] = ["OPEN", "TEST", "ADMISSION", "WON", "LOST"];

export const STAGE_KIND_LABELS: Record<StageKind, string> = {
  OPEN: "Em processo",
  TEST: "Teste",
  ADMISSION: "Admissão",
  WON: "Contratado",
  LOST: "Reprovado",
};

export const STAGE_KIND_DESCRIPTIONS: Record<StageKind, string> = {
  OPEN: "Etapa comum do processo seletivo (triagem, entrevistas…).",
  TEST: "O candidato responde a um teste do banco de avaliações.",
  ADMISSION: "O candidato segue para a admissão.",
  WON: "Conta como contratação nos indicadores de recrutamento.",
  LOST: "Conta como reprovação nos indicadores de recrutamento.",
};

export function isStageKind(v: unknown): v is StageKind {
  return typeof v === "string" && (STAGE_KINDS as string[]).includes(v);
}

export interface StageAutomations {
  openAdmission?: boolean;
  createTestLink?: boolean;
}

export type AutomationKey = keyof StageAutomations;

export interface AutomationDef {
  key: AutomationKey;
  label: string;
  description: string;
  kinds: StageKind[];
  defaultOn: boolean;
  /** A automação depende de um teste vinculado à etapa. */
  requiresTemplate?: boolean;
}

export const AUTOMATIONS: AutomationDef[] = [
  {
    key: "openAdmission",
    label: "Abrir o cadastro da admissão",
    description:
      "Ao mover o candidato para esta etapa, o painel abre o cadastro da admissão com os dados dele já preenchidos.",
    kinds: ["ADMISSION", "WON"],
    defaultOn: true,
  },
  {
    key: "createTestLink",
    label: "Gerar o link do teste vinculado",
    description:
      "Ao entrar nesta etapa, o link do teste é criado automaticamente e fica disponível na ficha do candidato para envio.",
    kinds: ["TEST"],
    defaultOn: false,
    requiresTemplate: true,
  },
];

/** Automações disponíveis para um tipo de etapa. */
export function automationsFor(kind: StageKind): AutomationDef[] {
  return AUTOMATIONS.filter((a) => a.kinds.includes(kind));
}

/** Lê o JSON do banco com tolerância (chaves desconhecidas são ignoradas). */
export function parseAutomations(raw: unknown): StageAutomations {
  if (!raw || typeof raw !== "object") return {};
  const out: StageAutomations = {};
  for (const def of AUTOMATIONS) {
    const v = (raw as Record<string, unknown>)[def.key];
    if (typeof v === "boolean") out[def.key] = v;
  }
  return out;
}

/** A automação está ligada para esta etapa? (considera o tipo e o padrão). */
export function isAutomationOn(
  stage: { kind?: string | null; automations?: unknown; templateId?: string | null },
  key: AutomationKey
): boolean {
  const def = AUTOMATIONS.find((a) => a.key === key);
  if (!def || !isStageKind(stage.kind) || !def.kinds.includes(stage.kind)) return false;
  if (def.requiresTemplate && !stage.templateId) return false;
  const value = parseAutomations(stage.automations)[key];
  return value ?? def.defaultOn;
}
