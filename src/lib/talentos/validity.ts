import type { TesteValidezResult } from "./types";

export interface SessionForValidity {
  submittedAt:  string | null;
  validoAte:    string | null;
  invalidadoEm: string | null;
}

/**
 * Regra central de validade de teste — fonte única de verdade.
 * Recebe a sessão mais recente concluída para um talento+template.
 * Nunca replicar esta lógica em outros pontos do código.
 */
export function computeValidez(
  session: SessionForValidity | null | undefined,
  dataReferencia: Date = new Date(),
): TesteValidezResult {
  if (!session?.submittedAt) return { valido: false, motivo: 'nunca_realizado' };
  if (session.invalidadoEm)  return { valido: false, motivo: 'invalidado_pelo_rh' };
  if (!session.validoAte)    return { valido: false, motivo: 'nunca_realizado' };

  const validoAte = new Date(session.validoAte);
  if (dataReferencia > validoAte) {
    return { valido: false, motivo: 'expirado', expirouEm: validoAte };
  }

  const diasRestantes = Math.floor(
    (validoAte.getTime() - dataReferencia.getTime()) / (1000 * 60 * 60 * 24),
  );
  return { valido: true, validoAte, diasRestantes };
}

/**
 * Computa e persiste validoAte no momento da submissão.
 * Chamado uma única vez, no route handler de submissão.
 */
export function computeValidoAte(submittedAt: Date, validityMonths: number): Date {
  const d = new Date(submittedAt);
  d.setMonth(d.getMonth() + validityMonths);
  return d;
}

export const AVISO_VENCIMENTO_DIAS = 30;

export function estaVencendoEm30Dias(result: TesteValidezResult): boolean {
  return result.valido && result.diasRestantes <= AVISO_VENCIMENTO_DIAS;
}
