-- Ordenação manual (drag-and-drop) dos modelos de checklist de admissão.
-- Antes os modelos eram listados apenas por nome; agora têm posição persistida.

alter table "admission_checklist_templates"
  add column if not exists "sortOrder" integer not null default 0;

-- Backfill: numera os modelos existentes seguindo a ordem alfabética atual,
-- para que a lista não embaralhe na primeira carga após a migração.
with ordered as (
  select "id", row_number() over (order by "name" asc) as rn
  from "admission_checklist_templates"
)
update "admission_checklist_templates" t
set "sortOrder" = ordered.rn
from ordered
where t."id" = ordered."id";
