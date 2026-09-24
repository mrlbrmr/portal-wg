// Avanço automático para a "etapa de recebimento dos documentos" (admission_stages.
// isDocumentIntake). Regra PURA, usada pelas rotas públicas do formulário digital:
//   • dispara quando o candidato envia o 1º documento ou o formulário completo;
//   • só avança — admissão sem etapa ou em etapa ANTERIOR (sortOrder menor) vai para a
//     etapa marcada; quem já está nela, depois dela ou concluída não se mexe;
//   • etapa marcada desativada = automação desligada.

export interface IntakeStage {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  isFinal: boolean;
  isDocumentIntake: boolean;
}

export interface IntakeMove {
  from: IntakeStage | null;
  to: IntakeStage;
}

export function documentIntakeMove(stages: IntakeStage[], currentStageId: string | null): IntakeMove | null {
  // Nunca conclui uma admissão sozinha, mesmo se a etapa marcada virar a de conclusão.
  const target = stages.find((s) => s.isDocumentIntake && s.active && !s.isFinal);
  if (!target) return null;
  if (!currentStageId) return { from: null, to: target };
  if (currentStageId === target.id) return null;

  const current = stages.find((s) => s.id === currentStageId);
  if (!current) return null;
  if (current.isFinal || current.sortOrder >= target.sortOrder) return null;
  return { from: current, to: target };
}
