// Formulário de admissão parado no meio — módulo PURO (testado em stalled-forms.test.ts).
//
// O candidato sobe documentos um a um, mas só o envio final grava as respostas e avisa
// o RH. Se ele começou (há anexo do link) e sumiu, o RH recebe um resumo diário
// (cron em /api/cron/formularios-parados) para cobrar o candidato.
//
// Um aviso por parada: depois de avisado, a admissão só volta ao resumo se o candidato
// enviar um arquivo novo e parar de novo.

/** Horas sem novo arquivo para considerar que o candidato parou (e não que está preenchendo). */
export const STALLED_FORM_HOURS = 3

/** Paradas mais antigas que isso não são avisadas (o link vale 7 dias; evita avisar abandonos antigos). */
export const STALLED_FORM_MAX_DAYS = 7

export interface StalledFormInput {
  submittedAt: string | null
  hasToken: boolean
  isFinal: boolean
  /** Último arquivo enviado pelo link (null = candidato não enviou nada). */
  lastUploadAt: string | null
  /** Último aviso de formulário parado registrado para a admissão. */
  lastNoticeAt: string | null
}

export function isFormStalled(a: StalledFormInput, now: Date = new Date()): boolean {
  if (a.submittedAt || !a.hasToken || a.isFinal || !a.lastUploadAt) return false
  const last = new Date(a.lastUploadAt).getTime()
  const idle = now.getTime() - last
  if (idle < STALLED_FORM_HOURS * 3_600_000 || idle > STALLED_FORM_MAX_DAYS * 86_400_000) return false
  return !a.lastNoticeAt || new Date(a.lastNoticeAt).getTime() < last
}
