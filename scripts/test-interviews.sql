-- Agenda de entrevistas (application_interviews): RLS, checks, autor preservado e cascatas.
-- Transação com ROLLBACK:
--   node scripts/run-sql-test.mjs scripts/test-interviews.sql [supabase/migrations/20261104180000_application_interviews.sql]
do $$
declare
  job_a text;
  app_a text;
  app_b text;
  iv text;
  asm text;
  n int;
  ok boolean;
  admin_claims  text := '{"role":"authenticated","app_metadata":{"user_role":"ADMIN_RH","app_user_id":"test-admin"}}';
  viewer_claims text := '{"role":"authenticated","app_metadata":{"user_role":"VIEWER_RH","app_user_id":"test-viewer"}}';
begin
  insert into public.jobs (title, city, state, modality, "contractType", description, slug, status, visibility)
  values ('Teste Agenda', 'Curitiba', 'PR', 'PRESENTIAL', 'CLT', '<p>A</p>', 'teste-agenda', 'ACTIVE', 'NONE') returning id into job_a;
  insert into public.applications ("jobId", "fullName", email, phone, "consentAt", "stageId")
  values (job_a, 'Candidata Agenda', 'agenda@teste.local', '11999990303', now(), 'NEW') returning id into app_a;
  insert into public.applications ("jobId", "fullName", email, phone, "consentAt", "stageId")
  values (job_a, 'Candidato Agenda 2', 'agenda2@teste.local', '11999990304', now(), 'NEW') returning id into app_b;

  -- C1: ADMIN_RH insere entrevista HR
  perform set_config('request.jwt.claims', admin_claims, true);
  set local role authenticated;
  insert into public.application_interviews ("applicationId", round, "scheduledAt", "durationMin", location, "interviewerName", notes, "createdBy")
  values (app_a, 'HR', now() + interval '1 day', 45, 'Sala 1', 'Fulana RH', 'Levar documento', 'Admin Teste')
  returning id into iv;
  select count(*) into n from public.application_interviews where id = iv and status = 'SCHEDULED';
  if n <> 1 then raise exception 'C1: entrevista não inserida como SCHEDULED'; end if;
  raise notice 'C1 ok — ADMIN_RH agenda entrevista (status padrão SCHEDULED)';

  -- C2: VIEWER_RH lê, mas não escreve
  perform set_config('request.jwt.claims', viewer_claims, true);
  select count(*) into n from public.application_interviews where id = iv;
  if n <> 1 then raise exception 'C2: VIEWER_RH deveria ler 1 linha, leu %', n; end if;
  ok := false;
  begin
    insert into public.application_interviews ("applicationId", round, "scheduledAt")
    values (app_a, 'MANAGER', now() + interval '2 days');
  exception when others then ok := true;
  end;
  if not ok then raise exception 'C2: INSERT do VIEWER_RH deveria falhar por RLS'; end if;
  update public.application_interviews set notes = 'hack' where id = iv;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'C2: UPDATE do VIEWER_RH afetou % linha(s)', n; end if;
  perform set_config('request.jwt.claims', admin_claims, true);
  if (select notes from public.application_interviews where id = iv) <> 'Levar documento' then
    raise exception 'C2: notes foi alterado pelo VIEWER_RH';
  end if;
  raise notice 'C2 ok — VIEWER_RH só lê; INSERT/UPDATE bloqueados por RLS';

  -- C3: checks
  ok := false;
  begin
    insert into public.application_interviews ("applicationId", round, "scheduledAt", "durationMin") values (app_a, 'HR', now(), 4);
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'C3: durationMin = 4 deveria violar check'; end if;
  ok := false;
  begin
    insert into public.application_interviews ("applicationId", round, "scheduledAt", "durationMin") values (app_a, 'HR', now(), 481);
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'C3: durationMin = 481 deveria violar check'; end if;
  ok := false;
  begin
    insert into public.application_interviews ("applicationId", round, "scheduledAt", status) values (app_a, 'HR', now(), 'X');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'C3: status = X deveria violar check'; end if;
  ok := false;
  begin
    insert into public.application_interviews ("applicationId", round, "scheduledAt") values (app_a, '', now());
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'C3: round vazio deveria violar check'; end if;
  raise notice 'C3 ok — checks de duração, status e rodada';

  -- C4: UPDATE não muda applicationId / createdBy / createdAt
  update public.application_interviews
     set "applicationId" = app_b, "createdBy" = 'Trocado', "createdAt" = now() - interval '10 days',
         location = 'Sala 2', "updatedById" = 'test-admin', "updatedByName" = 'Admin Teste'
   where id = iv;
  reset role;
  if (select "applicationId" from public.application_interviews where id = iv) <> app_a then raise exception 'C4: candidatura trocada'; end if;
  if (select "createdBy" from public.application_interviews where id = iv) <> 'Admin Teste' then raise exception 'C4: createdBy alterado'; end if;
  if (select "createdAt" < now() - interval '1 day' from public.application_interviews where id = iv) then raise exception 'C4: createdAt alterado'; end if;
  if (select location from public.application_interviews where id = iv) <> 'Sala 2' then raise exception 'C4: edição não gravou'; end if;
  raise notice 'C4 ok — edição preserva candidatura/autor/criação';

  -- C5: apagar a avaliação ligada deixa assessmentId nulo
  insert into public.application_assessments ("applicationId", kind, source, title, "createdBy")
  values (app_a, 'INTERVIEW', 'HUMAN', 'Entrevista RH', 'Admin Teste') returning id into asm;
  update public.application_interviews set "assessmentId" = asm where id = iv;
  delete from public.application_assessments where id = asm;
  if (select "assessmentId" from public.application_interviews where id = iv) is not null then
    raise exception 'C5: assessmentId deveria ficar nulo';
  end if;
  raise notice 'C5 ok — apagar a avaliação desvincula a entrevista (on delete set null)';

  -- C6: apagar a candidatura apaga a entrevista
  delete from public.applications where id = app_a;
  select count(*) into n from public.application_interviews where id = iv;
  if n <> 0 then raise exception 'C6: entrevista deveria ser apagada com a candidatura'; end if;
  raise notice 'C6 ok — cascata da candidatura';
end $$;
