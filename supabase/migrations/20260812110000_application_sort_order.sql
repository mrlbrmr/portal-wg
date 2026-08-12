-- Adiciona coluna de ordenação manual para candidaturas no Kanban.
-- Nula por padrão → ordenação por aiScore. Preenchida quando o usuário
-- reordena manualmente dentro de uma coluna.
alter table "applications" add column if not exists "sort_order" integer;
