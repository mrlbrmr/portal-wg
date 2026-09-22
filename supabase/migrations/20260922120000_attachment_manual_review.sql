-- Revisão manual de documentos da admissão pelo RH.
-- Separada do parecer da IA (aiStatus/aiReason): a decisão humana prevalece sobre a IA
-- e não é sobrescrita quando a validação automática roda de novo.
-- Aditiva: o código antigo continua funcionando (ignora as colunas novas).

alter table "admission_attachments"
  add column if not exists "reviewStatus" text check ("reviewStatus" in ('approved', 'rejected')),
  add column if not exists "reviewReason" text,
  add column if not exists "reviewedById" text, -- sem FK, como createdById/uploadedById (id da sessão)
  add column if not exists "reviewedAt"   timestamptz;
