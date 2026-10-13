-- ========================================================================================
-- PUBLICAÇÃO SEPARADA DO PROCESSO SELETIVO  ("Não publicar")
--
-- Status (jobs.status) diz se o processo seletivo está aberto. A publicação (jobs.visibility)
-- diz EM QUAIS canais ele aparece. Até aqui toda vaga aberta aparecia em algum canal; agora
-- o RH pode manter o processo aberto e propositalmente fora de todos eles:
--
--   NONE     → Não publicar: só o RH vê no painel. Fora do Portal, da Intranet, da página
--              pelo link, do sitemap, dos feeds (Google/Indeed) e da API pública.
--   BOTH     → Portal de Carreiras + Intranet (padrão)
--   PUBLIC   → só no Portal de Carreiras
--   INTERNAL → só na Intranet
--
-- Regra central (espelho em src/lib/jobs/publication.ts):
--   processo apto (status aberto) + canal habilitado + inscrições no prazo.
--
-- ADITIVA: só acrescenta um valor ao enum. Nenhuma vaga muda (BOTH/PUBLIC/INTERNAL seguem
-- iguais) e o código antigo continua funcionando durante o build — ninguém consegue gravar
-- NONE antes do deploy novo.
--
-- Observação: `alter type … add value` não pode ser USADO na mesma transação em que é
-- criado; por isso a policy abaixo compara o texto (visibility::text), não o literal do enum.
-- ========================================================================================

alter type "JobVisibility" add value if not exists 'NONE';

comment on column public."jobs"."visibility" is
  'Publicação da vaga: NONE (não publicar — só o painel), BOTH (Portal + Intranet), PUBLIC (só Portal), INTERNAL (só Intranet; fora da lista pública, sitemap e feeds).';

-- Leitura pública (anon e autenticados sem papel de RH): vaga aberta E publicada em algum
-- canal. Defesa em profundidade — as consultas públicas já filtram pelo helper central.
drop policy if exists jobs_public_select on public.jobs;
create policy jobs_public_select on public.jobs for select to anon, authenticated
  using (
    status in ('ACTIVE', 'SCREENING', 'INTERVIEW', 'ADMISSION')
    and "visibility"::text <> 'NONE'
  );
