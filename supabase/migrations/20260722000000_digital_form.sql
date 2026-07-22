-- Formulário de admissão digital nativo (substitui Tally + WhatsApp)

-- 1. Campos do formulário na tabela admissions
alter table "admissions"
  add column if not exists "gender"                  text,
  add column if not exists "maritalStatus"           text,
  add column if not exists "hasChildren"             boolean,
  add column if not exists "needsTransportVoucher"   boolean,
  add column if not exists "transportVoucherDetails" text,
  add column if not exists "hasItauAccount"          boolean,
  add column if not exists "bankAgency"              text,
  add column if not exists "bankAccount"             text,
  add column if not exists "colorDeclaration"        text,
  add column if not exists "isDriverOperator"        boolean,
  -- Token de acesso ao formulário público (link único por candidato)
  add column if not exists "digitalFormToken"        text unique,
  add column if not exists "digitalFormExpiresAt"    timestamptz,
  add column if not exists "digitalFormSubmittedAt"  timestamptz;

create index if not exists "admissions_digitalFormToken_idx"
  on "admissions" ("digitalFormToken");

-- 2. Validação por IA nos anexos
alter table "admission_attachments"
  add column if not exists "aiStatus"    text check ("aiStatus" in ('pending', 'approved', 'needs_review', 'rejected')),
  add column if not exists "aiReason"    text,
  add column if not exists "aiCheckedAt" timestamptz;

-- 3. Tipos de documento do formulário
insert into "admission_document_types" ("name", "required", "sortOrder") values
  ('RG/CNH - Frente e verso',                                   true,   1),
  ('CTPS - Frente e verso ou CTPS Digital',                     true,   2),
  ('Comprovante de residência',                                 true,   3),
  ('Comprovante de escolaridade',                               true,   4),
  ('Título de Eleitor',                                          true,   5),
  ('Certificado de reservista/dispensa do Exército',            false,  6),
  ('Certidão de casamento/união estável/averbação de divórcio', false,  7),
  ('Certidão de nascimento/RG dos filhos',                      false,  8),
  ('Carteira de vacinação (filhos até 5 anos)',                 false,  9),
  ('Comprovante de matrícula (filhos 6-14 anos)',               false, 10),
  ('Comprovante de conta Itaú',                                 false, 11),
  ('Certificado MOPP + CNH com observação',                     false, 12),
  ('Certificado Operador de Empilhadeira',                      false, 13)
on conflict ("name") do update set
  "required"  = excluded."required",
  "sortOrder" = excluded."sortOrder";
