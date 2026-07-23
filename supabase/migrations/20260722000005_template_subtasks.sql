-- Subtarefas nos modelos de checklist (mesma lógica das admissões: 1 nível).
-- Espelha admission_checklist_items.parentId: item-mãe → subtarefas.
-- Migração ADITIVA (coluna nullable) → não quebra o código em produção.

alter table "admission_template_items"
  add column if not exists "parentId" text
    references "admission_template_items"("id") on delete cascade;

create index if not exists "admission_template_items_parent_idx"
  on "admission_template_items" ("parentId");
