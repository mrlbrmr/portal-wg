-- Modelo de checklist para VÁRIAS funções (cargos): relação N:N.
--
-- Antes cada modelo tinha um único "positionId" (ou null = "Todos os cargos").
-- Agora um modelo pode ser vinculado a vários cargos via tabela de junção.
-- Migração ADITIVA: a coluna "positionId" é mantida (legado) para não quebrar o
-- código ainda em produção durante o deploy; o app passa a usar a junção.

create table if not exists "admission_template_positions" (
  "templateId" text not null references "admission_checklist_templates"("id") on delete cascade,
  "positionId" text not null references "admission_positions"("id") on delete cascade,
  primary key ("templateId", "positionId")
);

create index if not exists "admission_template_positions_position_idx"
  on "admission_template_positions" ("positionId");

-- Backfill: cada modelo com um cargo definido vira uma linha na junção.
insert into "admission_template_positions" ("templateId", "positionId")
select "id", "positionId"
from "admission_checklist_templates"
where "positionId" is not null
on conflict do nothing;

-- RLS: interna (staff lê, admin escreve), sem acesso anon.
alter table "admission_template_positions" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'admission_template_positions' and policyname = 'atp_staff_select'
  ) then
    create policy atp_staff_select on public.admission_template_positions
      for select to authenticated using (public.is_staff());
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'admission_template_positions' and policyname = 'atp_admin_all'
  ) then
    create policy atp_admin_all on public.admission_template_positions
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
