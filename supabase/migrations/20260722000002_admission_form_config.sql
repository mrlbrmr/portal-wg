-- Editor TOTAL do formulário de admissão digital
--  · configuração editável (textos, opções, perguntas, documentos e condições)
--  · campos extras respondidos pelo candidato (ex.: número do PIS)
--  · novo tipo de documento: RG/CNH do Cônjuge (condicional a "Casado(a)")

-- 1. Configuração editável do formulário (linha única, JSON) ────────────────────
create table if not exists "admission_form_config" (
  "id"          text        primary key default 'default',
  "config"      jsonb       not null,
  "updatedById" text,
  "updatedAt"   timestamptz not null default now()
);

alter table "admission_form_config" enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'admission_form_config' and policyname = 'afc_staff_select') then
    create policy afc_staff_select on public.admission_form_config
      for select to authenticated using (public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'admission_form_config' and policyname = 'afc_admin_all') then
    create policy afc_admin_all on public.admission_form_config
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- 2. Campos extras do formulário respondidos pelo candidato (ex.: PIS) ──────────
alter table "admissions"
  add column if not exists "formExtras" jsonb;

-- 3. Novo tipo de documento: RG/CNH do cônjuge (condicional a Casado(a)) ────────
insert into "admission_document_types" ("name", "required", "sortOrder") values
  ('RG/CNH do Cônjuge - Frente e verso', false, 14)
on conflict ("name") do update set "sortOrder" = excluded."sortOrder";
