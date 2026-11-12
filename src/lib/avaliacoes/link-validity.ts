// Validade dos links de teste (assessment_sessions). Puro e testado (link-validity.test.ts).
//
// • Todo link nasce com prazo: DEFAULT_TEST_LINK_DAYS (decisão de 2026-11-12), seja no envio
//   manual (pipeline/Quick View), no reenvio pelo Banco de Talentos ou na automação da etapa.
//   Depois do prazo o link mostra "Link expirado" e a aplicação aparece como "Expirado".
// • Quando a pessoa conclui um teste, os OUTROS envios pendentes do MESMO teste para a MESMA
//   candidatura são invalidados (nunca apagados) — senão a fila "aguardando o candidato"
//   conta para sempre um link que ninguém vai responder.

export const DEFAULT_TEST_LINK_DAYS = 7;

/** Motivo gravado em assessment_sessions."motivoInvalidacao" ao concluir outro envio. */
export const SUPERSEDED_REASON = "Respondido em outro envio do mesmo teste";

export function testLinkExpiresAt(from: Date, days: number = DEFAULT_TEST_LINK_DAYS): string {
  return new Date(from.getTime() + days * 86_400_000).toISOString();
}

export interface SessionLinkInput {
  id: string;
  applicationId: string | null;
  templateId: string;
  submittedAt: string | null;
  invalidadoEm: string | null;
}

/** Envios pendentes que perdem o sentido quando `submitted` é concluído. */
export function supersededSessionIds(submitted: SessionLinkInput, all: readonly SessionLinkInput[]): string[] {
  if (!submitted.applicationId) return [];
  return all
    .filter(
      (s) =>
        s.id !== submitted.id &&
        s.applicationId === submitted.applicationId &&
        s.templateId === submitted.templateId &&
        !s.submittedAt &&
        !s.invalidadoEm
    )
    .map((s) => s.id);
}
