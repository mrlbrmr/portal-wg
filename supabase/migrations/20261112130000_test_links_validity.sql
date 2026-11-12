-- Validade dos links de teste (auditoria 2026-11-12, achado R9). SÓ DADOS, idempotente.
-- A partir de agora todo link nasce com 7 dias (src/lib/avaliacoes/link-validity.ts). Para os
-- envios antigos, ainda pendentes e sem prazo:
--   1) envio pendente de um teste que a MESMA candidatura já concluiu em outro envio
--      → invalidado (motivo registrado; nada é apagado);
--   2) demais pendentes sem prazo → prazo = data do envio + 7 dias (os antigos ficam "Expirado").
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--            supabase/migrations/20261112130000_test_links_validity.sql 20261112130000

update "assessment_sessions" s
   set "invalidadoEm" = now(),
       "motivoInvalidacao" = 'Respondido em outro envio do mesmo teste'
 where s."submittedAt" is null
   and s."invalidadoEm" is null
   and s."applicationId" is not null
   and exists (
     select 1 from "assessment_sessions" x
      where x."applicationId" = s."applicationId"
        and x."templateId" = s."templateId"
        and x."submittedAt" is not null
        and x."id" <> s."id"
   );

update "assessment_sessions"
   set "expiresAt" = "createdAt" + interval '7 days'
 where "submittedAt" is null
   and "invalidadoEm" is null
   and "expiresAt" is null;
