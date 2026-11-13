-- Validação por IA: falha técnica ≠ problema no documento (ver src/lib/admissao/ai-validation.ts).
--
-- ADITIVA — aplicar ANTES do push (o código novo grava aiStatus = 'unavailable'):
--   1) a regra da coluna passa a aceitar 'unavailable' ("Não verificado pela IA");
--   2) anexos que ficaram em 'needs_review' por FALHA TÉCNICA (Gemini indisponível, limite,
--      erro genérico, formato sem leitura, chave ausente, resposta inválida) viram 'unavailable'.
--      A revisão do RH (reviewStatus) não é tocada e continua valendo sobre o parecer da IA.
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--            supabase/migrations/20261113140000_ai_status_unavailable.sql 20261113140000

alter table "admission_attachments" drop constraint if exists "admission_attachments_aiStatus_check";
alter table "admission_attachments" add constraint "admission_attachments_aiStatus_check"
  check ("aiStatus" = any (array['pending', 'approved', 'needs_review', 'rejected', 'unavailable']));

update "admission_attachments"
   set "aiStatus" = 'unavailable'
 where "aiStatus" = 'needs_review'
   and (   "aiReason" ilike '%erro na validação automática%'
        or "aiReason" ilike '%indispon%'
        or "aiReason" ilike '%limite gratuito%'
        or "aiReason" ilike '%não configurada%'
        or "aiReason" ilike '%formato sem validação%'
        or "aiReason" ilike '%erro ao baixar%'
        or "aiReason" ilike '%resposta da ia inválida%');
