-- Hub de avaliações (application_assessments evoluída): entrevista + parecer, referência,
-- backfill das entrevistas antigas, autor preservado e RLS. Transação com ROLLBACK:
--   node scripts/run-sql-test.mjs scripts/test-assessments-hub.sql [supabase/migrations/20261014120000_assessments_hub.sql]
do $$
declare
  job_a text;
  job_b text;
  app_a text;
  app_b text;
  rep text;
  n int;
  ok boolean;
  admin_claims  text := '{"role":"authenticated","app_metadata":{"user_role":"ADMIN_RH","app_user_id":"test-admin"}}';
  viewer_claims text := '{"role":"authenticated","app_metadata":{"user_role":"VIEWER_RH","app_user_id":"test-viewer"}}';
  doc jsonb := '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Boa aderência."}]}]}';
begin
  -- ── 0. Backfill: nenhuma entrevista fica sem recomendação estruturada ──────────────
  select count(*) into n from public.application_assessments where kind = 'INTERVIEW' and recommendation is null;
  if n <> 0 then raise exception 'C0: % entrevista(s) sem recomendação após o backfill', n; end if;
  select count(*) into n from public.application_assessments
   where kind = 'INTERVIEW' and outcome in ('RECOMMEND', 'PASS') and recommendation <> 'ADVANCE';
  if n <> 0 then raise exception 'C0: backfill RECOMMEND/PASS → ADVANCE incorreto'; end if;
  raise notice 'C0 ok — entrevistas antigas com recomendação derivada do resultado (texto/nota intactos)';

  -- Mesmo candidato em duas vagas = duas candidaturas.
  insert into public.jobs (title, city, state, modality, "contractType", description, slug, status, visibility)
  values ('Teste Hub A', 'Curitiba', 'PR', 'PRESENTIAL', 'CLT', '<p>A</p>', 'teste-hub-a', 'ACTIVE', 'NONE') returning id into job_a;
  insert into public.jobs (title, city, state, modality, "contractType", description, slug, status, visibility)
  values ('Teste Hub B', 'Curitiba', 'PR', 'PRESENTIAL', 'CLT', '<p>B</p>', 'teste-hub-b', 'ACTIVE', 'NONE') returning id into job_b;
  insert into public.applications ("jobId", "fullName", email, phone, "consentAt", "stageId")
  values (job_a, 'Candidata Hub', 'hub@teste.local', '11999990202', now(), 'NEW') returning id into app_a;
  insert into public.applications ("jobId", "fullName", email, phone, "consentAt", "stageId")
  values (job_b, 'Candidata Hub', 'hub@teste.local', '11999990202', now(), 'NEW') returning id into app_b;

  -- ── 1. ADMIN_RH registra entrevistas (com parecer) e referência ──────────────────
  perform set_config('request.jwt.claims', admin_claims, true);
  set local role authenticated;
  insert into public.application_assessments ("applicationId", kind, source, title, "interviewType", recommendation, content, "contentText", evaluator, "occurredAt", "createdBy", "authorId")
  values (app_a, 'INTERVIEW', 'HUMAN', 'Entrevista RH', 'HR', 'ADVANCE_WITH_CAVEATS', doc, 'Boa aderência.', 'Admin Teste', '2026-10-14T12:00:00Z', 'Admin Teste', 'test-admin')
  returning id into rep;
  insert into public.application_assessments ("applicationId", kind, source, title, "interviewType", recommendation, content, "contentText", evaluator, "occurredAt", "createdBy", "authorId")
  values (app_a, 'INTERVIEW', 'HUMAN', 'Entrevista com gestor', 'MANAGER', 'ADVANCE', doc, 'Boa aderência.', 'Admin Teste', '2026-10-15T12:00:00Z', 'Admin Teste', 'test-admin');
  insert into public.application_assessments ("applicationId", kind, source, title, "referenceCompany", "referenceContact", "referenceRelationship", "referenceResult", summary, "occurredAt", "createdBy", "authorId")
  values (app_a, 'REFERENCE', 'HUMAN', 'Referência', 'Empresa X', 'Fulana', 'Ex-gestora', 'POSITIVE', 'Recomenda.', '2026-10-15T12:00:00Z', 'Admin Teste', 'test-admin');
  insert into public.application_assessments ("applicationId", kind, source, title, "interviewType", recommendation, content, evaluator, "occurredAt", "createdBy", "authorId")
  values (app_b, 'INTERVIEW', 'HUMAN', 'Entrevista RH (vaga B)', 'HR', 'UNDEFINED', doc, 'Admin Teste', '2026-10-16T12:00:00Z', 'Admin Teste', 'test-admin');
  select count(*) into n from public.application_assessments where "applicationId" = app_a and kind = 'INTERVIEW';
  if n <> 2 then raise exception 'C1: esperava 2 entrevistas na candidatura A, veio %', n; end if;
  select count(*) into n from public.application_assessments where "applicationId" = app_b;
  if n <> 1 then raise exception 'C1: candidatura B deveria ter 1 avaliação, veio %', n; end if;
  raise notice 'C1 ok — várias entrevistas por candidatura; candidato em 2 vagas tem históricos separados';

  -- ── 2. Edição preserva autor, criação e candidatura ──────────────────────────────
  update public.application_assessments
     set title = 'Entrevista RH (revisada)', "authorId" = 'outra', "createdBy" = 'Trocado',
         "createdAt" = now() - interval '10 days', "applicationId" = app_b,
         "updatedById" = 'test-admin', "updatedByName" = 'Admin Teste'
   where id = rep;
  reset role;
  if (select "authorId" from public.application_assessments where id = rep) <> 'test-admin' then raise exception 'C2: autor perdido'; end if;
  if (select "createdBy" from public.application_assessments where id = rep) <> 'Admin Teste' then raise exception 'C2: createdBy alterado'; end if;
  if (select "applicationId" from public.application_assessments where id = rep) <> app_a then raise exception 'C2: candidatura trocada'; end if;
  if (select "createdAt" < now() - interval '1 day' from public.application_assessments where id = rep) then raise exception 'C2: createdAt alterado'; end if;
  if (select title from public.application_assessments where id = rep) <> 'Entrevista RH (revisada)' then raise exception 'C2: edição não gravou'; end if;
  raise notice 'C2 ok — edição preserva autor/criação/candidatura e registra o último editor';

  -- ── 3. Listas fechadas: recomendação e resultado da referência ───────────────────
  ok := false;
  begin
    update public.application_assessments set recommendation = 'APROVADO' where id = rep;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'C3: recomendação inválida aceita'; end if;
  ok := false;
  begin
    update public.application_assessments set "referenceResult" = 'OTIMA' where id = rep;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'C3: resultado de referência inválido aceito'; end if;
  raise notice 'C3 ok — recomendação e resultado da referência são listas fechadas';

  -- ── 4. VIEWER_RH lê, mas não cria, edita nem exclui ─────────────────────────────
  perform set_config('request.jwt.claims', viewer_claims, true);
  set local role authenticated;
  select count(*) into n from public.application_assessments where "applicationId" in (app_a, app_b);
  if n <> 4 then raise exception 'C4: VIEWER_RH deveria ler 4 avaliações, leu %', n; end if;
  ok := false;
  begin
    insert into public.application_assessments ("applicationId", kind, source, title) values (app_a, 'INTERVIEW', 'HUMAN', 'Viewer');
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'C4: VIEWER_RH conseguiu criar'; end if;
  update public.application_assessments set title = 'hack' where id = rep;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'C4: VIEWER_RH conseguiu editar'; end if;
  delete from public.application_assessments where id = rep;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'C4: VIEWER_RH conseguiu excluir'; end if;
  reset role;
  raise notice 'C4 ok — VIEWER_RH só lê';

  -- ── 5. Público (anon) nunca enxerga avaliação ───────────────────────────────────
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  select count(*) into n from public.application_assessments;
  if n <> 0 then raise exception 'C5: anon enxerga avaliações'; end if;
  reset role;
  raise notice 'C5 ok — nenhuma exposição pública';

  -- ── 6. Excluir a candidatura leva as avaliações junto; outra vaga intacta ─────────
  delete from public.applications where id = app_a;
  select count(*) into n from public.application_assessments where "applicationId" = app_a;
  if n <> 0 then raise exception 'C6: avaliações órfãs'; end if;
  select count(*) into n from public.application_assessments where "applicationId" = app_b;
  if n <> 1 then raise exception 'C6: avaliação da outra vaga afetada'; end if;
  raise notice 'C6 ok — cascata pela candidatura';
end $$;
