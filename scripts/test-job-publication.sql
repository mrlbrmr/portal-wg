-- ========================================================================================
-- Teste de integração: PUBLICAÇÃO ("Não publicar") + MODELOS DE VAGA.
--
-- Roda em UMA transação terminada em ROLLBACK (nada fica no banco):
--   node scripts/run-sql-test.mjs scripts/test-job-publication.sql
--
-- Pré-requisito: migrações 20261013120000 e 20261013120100 JÁ aplicadas (o valor NONE do
-- enum não pode ser usado na mesma transação em que é criado).
-- ========================================================================================

do $$
declare
  req   uuid;
  job   text;
  manual text;
  tpl   text;
  n     int;
  v_desc text;
  v_req uuid;
begin
  -- ── Modelo ────────────────────────────────────────────────────────────────────────────
  insert into public.job_templates (name, title, department, responsibilities, benefits)
  values ('Teste Modelo Publicação', 'Auxiliar de Logística', 'Logística', '- Versão A', '- VT')
  returning id into tpl;

  -- ── 3/5. Vaga a partir da solicitação: vínculo nos dois lados ─────────────────────────
  insert into public.job_requests (status, title, openings, requester_name, reason_type, location, department)
  values ('APPROVED', 'Teste Publicação', 1, 'Gestor Teste', 'NEW_POSITION', 'Matriz', 'Expedição')
  returning id into req;
  select job_id into job from public.create_job_from_request(req, null, 'Teste', 'teste-publicacao');
  if (select "requestId" from public.jobs where id = job) <> req then raise exception 'C5: requestId não gravado'; end if;
  if (select job_id from public.job_requests where id = req) <> job then raise exception 'C5: job_id não gravado na solicitação'; end if;
  if (select visibility::text from public.jobs where id = job) <> 'BOTH' then raise exception 'C3: publicação padrão deveria ser BOTH'; end if;
  raise notice 'C3/C5 ok — vaga da solicitação nasce em Rascunho, BOTH, com vínculo nos dois lados';

  -- ── 4/5. RH aplica o modelo e abre o processo SEM publicar (o que o PATCH grava) ─────
  update public.jobs
     set description = '### Responsabilidades' || chr(10) || chr(10) || '- Versão A',
         "templateId" = tpl,
         status = 'ACTIVE',
         visibility = 'NONE'
   where id = job;
  select "requestId" into v_req from public.jobs where id = job;
  if v_req is distinct from req then raise exception 'C4/C5: aplicar o modelo mexeu no vínculo com a solicitação'; end if;
  if (select job_id from public.job_requests where id = req) <> job then raise exception 'C5: vínculo perdido'; end if;
  raise notice 'C4/C5 ok — modelo aplicado, vínculo Solicitação ↔ Vaga preservado';

  -- ── 7/10/11. Aberta + Não publicar: o público (anon) não enxerga ─────────────────────
  insert into public.jobs (title, city, state, modality, "contractType", description, slug, status, visibility)
  values ('Teste Publicação Manual', 'Curitiba', 'PR', 'PRESENTIAL', 'CLT', '<p>Vaga manual de teste</p>', 'teste-publicacao-manual', 'ACTIVE', 'BOTH')
  returning id into manual;

  set local role anon;
  select count(*) into n from public.jobs where id = job;
  if n <> 0 then raise exception 'C7: vaga ACTIVE + NONE visível para o público'; end if;
  select count(*) into n from public.jobs where id = manual;
  if n <> 1 then raise exception 'C7: vaga ACTIVE + BOTH deveria estar visível'; end if;
  reset role;
  raise notice 'C7/C10/C11 ok — RLS pública esconde ACTIVE + NONE (Portal, Intranet, feeds e link usam a mesma leitura)';

  -- ── 8. NONE → BOTH publica sem recriar ───────────────────────────────────────────────
  update public.jobs set visibility = 'BOTH' where id = job;
  set local role anon;
  select count(*) into n from public.jobs where id = job;
  if n <> 1 then raise exception 'C8: NONE → BOTH não publicou'; end if;
  reset role;
  raise notice 'C8 ok — NONE → BOTH publica a mesma vaga';

  -- ── 9. BOTH → NONE retira, mantendo vaga e candidatos ────────────────────────────────
  insert into public.applications ("jobId", "fullName", email, phone, "consentAt", "stageId")
  values (job, 'Candidato Teste', 'candidato@teste.local', '11999990009', now(), 'NEW');
  update public.jobs set visibility = 'NONE' where id = job;
  set local role anon;
  select count(*) into n from public.jobs where id = job;
  if n <> 0 then raise exception 'C9: BOTH → NONE não retirou'; end if;
  reset role;
  if (select count(*) from public.applications where "jobId" = job) <> 1 then raise exception 'C9: candidatos afetados'; end if;
  if (select status::text from public.jobs where id = job) <> 'ACTIVE' then raise exception 'C9: status afetado'; end if;
  raise notice 'C9 ok — BOTH → NONE retira da leitura pública; status e candidatos intactos';

  -- ── 12. Editar o modelo não altera a vaga ────────────────────────────────────────────
  select description into v_desc from public.jobs where id = job;
  update public.job_templates set responsibilities = '- Versão B', title = 'Outro cargo' where id = tpl;
  if (select description from public.jobs where id = job) <> v_desc then raise exception 'C12: vaga mudou com o modelo'; end if;
  if (select title from public.jobs where id = job) <> 'Teste Publicação' then raise exception 'C12: título da vaga mudou'; end if;
  raise notice 'C12 ok — editar o modelo não toca na vaga';

  -- ── 13. Arquivar (e até excluir) o modelo não afeta a vaga ───────────────────────────
  update public.job_templates set active = false where id = tpl;
  if (select description from public.jobs where id = job) <> v_desc then raise exception 'C13: arquivar mudou a vaga'; end if;
  if (select "templateId" from public.jobs where id = job) <> tpl then raise exception 'C13: procedência perdida ao arquivar'; end if;
  delete from public.job_templates where id = tpl;
  if (select "templateId" from public.jobs where id = job) is not null then raise exception 'C13: FK deveria virar null'; end if;
  if (select description from public.jobs where id = job) <> v_desc then raise exception 'C13: excluir mudou a vaga'; end if;
  raise notice 'C13 ok — arquivar/excluir o modelo não altera a vaga';
end $$;
