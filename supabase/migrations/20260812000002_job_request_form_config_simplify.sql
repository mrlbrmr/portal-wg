-- Simplifica o formulário de solicitação de vaga para gestores:
-- remove os dois campos técnicos de requisitos (Obrigatórios / Desejáveis)
-- e substitui por um único campo "Perfil do candidato" mais amigável.
-- Apenas o array "fields" é sobrescrito; title e description são preservados.

INSERT INTO "job_request_form_config" (id, title, description, fields, updated_at)
VALUES (
  'singleton',
  'Abertura de Vaga | WG Baterias',
  'Em caso de dúvidas no preenchimento do formulário entrar em contato com o time de Gente & Gestão!',
  '[
    {"id":"gestor","key":"gestor","label":"Gestor(a)","type":"text","required":true,"placeholder":"Nome completo do gestor(a)"},
    {"id":"funcao","key":"funcao","label":"Função","type":"text","required":true,"placeholder":"Ex: Auxiliar de Estoque, Vendedor(a)..."},
    {"id":"horario","key":"horario","label":"Horário de trabalho","type":"text","required":true,"placeholder":"Ex: Seg a Sex, 08h–17h"},
    {"id":"local","key":"local","label":"Local de trabalho","type":"select","required":true,"options":[]},
    {"id":"motivo","key":"motivo","label":"Motivo da abertura","type":"select","required":true,"options":["Substituição","Expansão de equipe","Nova posição","Cobertura temporária","Outro"]},
    {"id":"colaboradorSubstituido","key":"colaboradorSubstituido","label":"Nome do colaborador substituído","type":"text","required":false,"placeholder":"Nome completo do colaborador que está saindo","showWhen":{"fieldKey":"motivo","operator":"is","value":"Substituição"}},
    {"id":"perfil","key":"perfil","label":"Perfil do candidato","type":"textarea","required":false,"placeholder":"Descreva brevemente o perfil ideal: experiências, conhecimentos ou habilidades desejadas."},
    {"id":"observacoes","key":"observacoes","label":"Outras informações","type":"textarea","required":false,"placeholder":"Qualquer detalhe adicional sobre a vaga (opcional)."}
  ]'::jsonb,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  fields     = EXCLUDED.fields,
  updated_at = EXCLUDED.updated_at;
