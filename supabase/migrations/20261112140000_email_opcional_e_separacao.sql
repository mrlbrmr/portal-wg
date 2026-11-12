-- E-mail opcional no cadastro manual + separação de perfis misturados (auditoria 2026-11-12, R11).
--
-- O e-mail do talento é ÚNICO e era obrigatório: sem o e-mail do candidato, o RH digitava um
-- fictício (email@email.com, editar@gmail.com…) e a 2ª pessoa com o mesmo fictício era ligada ao
-- perfil da 1ª. Resultado: 12 candidaturas de pessoas diferentes em 5 perfis.
--
-- 1) talentos.email e applications.email passam a aceitar NULL (aditiva: o código no ar só grava
--    e-mail preenchido). O índice único (emailNormalizado) já aceita vários NULL.
-- 2) Em cada perfil com e-mail fictício, a candidatura mais antiga fica no perfil original (o nome
--    do perfil é o dela); cada uma das outras ganha um perfil PRÓPRIO com os dados da candidatura.
--    Anotações, tags e histórico do perfil original ficam onde estão.
-- 3) O e-mail fictício vira NULL nos perfis e nas candidaturas.
-- Lista de fictícios = src/lib/email-placeholder.ts (os encontrados em produção).
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--            supabase/migrations/20261112140000_email_opcional_e_separacao.sql 20261112140000

alter table "talentos" alter column "email" drop not null;
alter table "applications" alter column "email" drop not null;

do $$
declare
  fake text[] := array['email@email.com', 'editar@email.com', 'editar@editar.com', 'editar@gmail.com', 'ajustar@email.com'];
  r record;
  novo text;
begin
  for r in
    select a."id" as app_id, a."fullName", a."phone", a."cpf", a."candidateCity", a."candidateState",
           a."resumeUrl", a."resumeName", a."salaryExpectation", a."createdAt"
      from "applications" a
      join "talentos" t on t."id" = a."talentoId"
     where lower(btrim(t."email")) = any (fake)
       and a."id" <> (
         select a2."id" from "applications" a2
          where a2."talentoId" = t."id"
          order by a2."createdAt", a2."id"
          limit 1
       )
  loop
    insert into "talentos" (
      "nomeCompleto", "email", "telefone", "cpf", "cidade", "estado",
      "curriculoUrl", "curriculoNome", "pretensaoSalarial", "origem", "createdAt", "ultimaAtividadeEm"
    ) values (
      r."fullName", null, nullif(r."phone", ''), r."cpf", r."candidateCity", r."candidateState",
      r."resumeUrl", r."resumeName", r."salaryExpectation", 'VAGA_ESPECIFICA', r."createdAt", r."createdAt"
    )
    returning "id" into novo;

    update "applications" set "talentoId" = novo where "id" = r.app_id;
  end loop;

  update "talentos" set "email" = null where lower(btrim("email")) = any (fake);
  update "applications" set "email" = null where lower(btrim("email")) = any (fake);
end $$;
