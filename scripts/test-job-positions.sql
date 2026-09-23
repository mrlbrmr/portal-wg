-- ========================================================================================
-- Teste de integração das POSIÇÕES DA VAGA (cenários 1–10 do redesenho da vaga).
--
-- Roda a migração + os cenários dentro de UMA transação e termina em ROLLBACK: nada fica
-- no banco. Qualquer asserção falha com `raise exception` e aborta tudo.
--
--   node scripts/run-sql-test.mjs scripts/test-job-positions.sql
--
-- O runner concatena: begin; <migração> ; <este arquivo> ; rollback;
-- ========================================================================================

do $$
declare
  req1 uuid; req2 uuid;
  job1 text; job2 text; legacy text;
  app_a text; app_b text; app_c text;
  p1 text; p2 text; p3 text;
  s jsonb;
  n int;
  failed boolean;
  msg text;
begin
  -- ── CENÁRIO 1: solicitação de 1 profissional → vaga com 1 posição ────────────────────
  insert into public.job_requests (status, title, openings, requester_name, reason_type, location, department)
  values ('APPROVED', 'Teste Posições A', 1, 'Gestor Teste', 'NEW_POSITION', 'Matriz', 'Logística')
  returning id into req1;
  select job_id into job1 from public.create_job_from_request(req1, null, 'Teste', 'teste-posicoes-a');
  select count(*) into n from public.job_positions where "jobId" = job1;
  if n <> 1 then raise exception 'C1: esperava 1 posição, veio %', n; end if;
  if (select "openings" from public.jobs where id = job1) <> 1 then raise exception 'C1: openings <> 1'; end if;
  raise notice 'C1 ok — 1 profissional → 1 posição';

  -- ── CENÁRIO 2: solicitação de 2 → #01 e #02 ──────────────────────────────────────────
  insert into public.job_requests (status, title, openings, requester_name, reason_type, location, department)
  values ('APPROVED', 'Teste Posições B', 2, 'Paulo Teste', 'REPLACEMENT', 'Nova Iguaçu', 'Logística')
  returning id into req2;
  select job_id into job2 from public.create_job_from_request(req2, null, 'Teste', 'teste-posicoes-b');
  select string_agg("positionNumber"::text, ',' order by "positionNumber") = '1,2'
    into failed from public.job_positions where "jobId" = job2 and status = 'OPEN';
  if not failed then raise exception 'C2: esperava #01,#02 em aberto'; end if;
  if (select ("approvedScope"->>'openings')::int from public.jobs where id = job2) <> 2 then
    raise exception 'C2: snapshot aprovado sem openings = 2';
  end if;
  select id into p1 from public.job_positions where "jobId" = job2 and "positionNumber" = 1;
  select id into p2 from public.job_positions where "jobId" = job2 and "positionNumber" = 2;
  raise notice 'C2 ok — 2 profissionais → #01 e #02 + snapshot aprovado';

  -- Candidaturas na vaga 2
  insert into public.applications ("jobId", "fullName", email, phone, "consentAt", "stageId")
  values (job2, 'João da Silva', 'joao@teste.local', '11999990001', now(), 'NEW') returning id into app_a;
  insert into public.applications ("jobId", "fullName", email, phone, "consentAt", "stageId")
  values (job2, 'Maria Souza', 'maria@teste.local', '11999990002', now(), 'NEW') returning id into app_b;
  insert into public.applications ("jobId", "fullName", email, phone, "consentAt", "stageId")
  values (job1, 'Outra Vaga', 'outra@teste.local', '11999990003', now(), 'NEW') returning id into app_c;

  -- ── CENÁRIO 3: preencher #01 → 1 de 2, vaga continua ativa ───────────────────────────
  s := public.job_position_fill(p1, app_a, null, date '2026-10-01', null, 'Teste');
  if (s->>'filled')::int <> 1 or (s->>'total')::int <> 2 or (s->>'allFilled')::boolean then
    raise exception 'C3: resumo inesperado %', s;
  end if;
  if (select "openPositions" from public.jobs where id = job2) <> 1 then raise exception 'C3: openPositions <> 1'; end if;
  if (select status from public.jobs where id = job2) <> 'DRAFT' then raise exception 'C3: status da vaga mudou sozinho'; end if;
  raise notice 'C3 ok — #01 preenchida, 1 de 2, vaga segue no mesmo status';

  -- Regras: posição ocupada não aceita segundo contratado; mesmo candidato não ocupa duas.
  failed := false;
  begin perform public.job_position_fill(p1, app_b, null, null, null, 'Teste');
  exception when others then failed := true; end;
  if not failed then raise exception 'Regra: posição preenchida aceitou segundo contratado'; end if;
  failed := false;
  begin perform public.job_position_fill(p2, app_a, null, null, null, 'Teste');
  exception when others then failed := true; end;
  if not failed then raise exception 'Regra: mesmo candidato ocupou duas posições'; end if;
  failed := false;
  begin perform public.job_position_fill(p2, app_c, null, null, null, 'Teste');
  exception when others then failed := true; end;
  if not failed then raise exception 'Regra: candidatura de outra vaga ocupou posição'; end if;
  raise notice 'Regras de preenchimento ok';

  -- ── CENÁRIO 4: preencher #02 → 2 de 2 → allFilled (a UI oferece encerrar) ────────────
  s := public.job_position_fill(p2, app_b, null, null, null, 'Teste');
  if not (s->>'allFilled')::boolean or (s->>'filled')::int <> 2 then raise exception 'C4: %', s; end if;
  if (select "openPositions" from public.jobs where id = job2) <> 0 then raise exception 'C4: openPositions <> 0'; end if;
  raise notice 'C4 ok — 2 de 2 preenchidas, allFilled = true';

  -- ── CENÁRIO 8: cancelar posição preenchida → recusado ────────────────────────────────
  failed := false;
  begin perform public.job_position_cancel(p2, 'teste', null, 'Teste');
  exception when others then failed := true; end;
  if not failed then raise exception 'C8: cancelou posição preenchida'; end if;
  raise notice 'C8 ok — posição preenchida não pode ser cancelada';

  -- ── CENÁRIO 5: desistência → libera #01, histórico preservado ────────────────────────
  s := public.job_position_release(p1, 'Desistência do candidato', null, 'Teste');
  if (select status from public.job_positions where id = p1) <> 'OPEN' then raise exception 'C5: #01 não reabriu'; end if;
  if not exists (
    select 1 from public.job_events
     where "positionId" = p1 and type = 'POSITION_RELEASED' and data->>'candidateName' = 'João da Silva'
       and reason = 'Desistência do candidato'
  ) then raise exception 'C5: histórico da desistência não registrado'; end if;
  -- A mesma pessoa pode voltar a ocupar depois de liberada (índice parcial só vale p/ FILLED).
  s := public.job_position_fill(p1, app_a, null, null, null, 'Teste');
  s := public.job_position_release(p1, 'Desistiu de novo', null, 'Teste');
  raise notice 'C5 ok — posição liberada, histórico preservado';

  -- ── CENÁRIO 6: adicionar terceira posição ────────────────────────────────────────────
  s := public.job_position_add(job2, 'Aumento de demanda', null, 'Teste');
  p3 := s->>'positionId';
  if (s->>'number')::int <> 3 or (s->>'total')::int <> 3 then raise exception 'C6: %', s; end if;
  if not exists (
    select 1 from public.job_events where "positionId" = p3 and type = 'POSITION_ADDED'
       and (data->>'from')::int = 2 and (data->>'to')::int = 3
  ) then raise exception 'C6: evento "2 → 3" não registrado'; end if;
  if (select ("approvedScope"->>'openings')::int from public.jobs where id = job2) <> 2 then
    raise exception 'C6: snapshot aprovado foi alterado';
  end if;
  raise notice 'C6 ok — #03 adicionada, 2 → 3 auditado, aprovado continua 2';

  -- ── CENÁRIO 7: cancelar posição aberta ───────────────────────────────────────────────
  s := public.job_position_cancel(p3, 'Demanda revista', null, 'Teste');
  if (s->>'total')::int <> 2 or (s->>'cancelled')::int <> 1 then raise exception 'C7: %', s; end if;
  if (select count(*) from public.job_positions where id = p3) <> 1 then raise exception 'C7: posição foi apagada'; end if;
  raise notice 'C7 ok — posição cancelada (não apagada)';

  -- Vaga específica não fica sem posição
  failed := false;
  begin perform public.job_position_cancel((select id from public.job_positions where "jobId" = job1), 'x', null, 'Teste');
  exception when others then failed := true; end;
  if not failed then raise exception 'Regra: cancelou a última posição de uma vaga específica'; end if;
  raise notice 'Regra ok — vaga específica mantém ao menos 1 posição';

  -- ── CENÁRIO 9: vaga avulsa com quantity = 5 → 5 posições ─────────────────────────────
  insert into public.jobs (title, city, state, modality, description, openings, "isTalentPool")
  values ('Legado 5', 'SP', 'SP', 'PRESENTIAL', 'x', 5, false) returning id into legacy;
  select count(*) into n from public.job_positions where "jobId" = legacy;
  if n <> 5 then raise exception 'C9: esperava 5 posições, veio %', n; end if;
  insert into public.jobs (title, city, state, modality, description, openings, "isTalentPool")
  values ('Banco', 'SP', 'SP', 'PRESENTIAL', 'x', null, true) returning id into legacy;
  if exists (select 1 from public.job_positions where "jobId" = legacy) then
    raise exception 'C9: banco de talentos ganhou posição';
  end if;
  raise notice 'C9 ok — quantity 5 → 5 posições; banco de talentos sem posições';

  -- ── CENÁRIO 10: vaga da solicitação mantém request_id e histórico ────────────────────
  if (select "requestId" from public.jobs where id = job2) <> req2 then raise exception 'C10: requestId perdido'; end if;
  if (select job_id from public.job_requests where id = req2) <> job2 then raise exception 'C10: job_id perdido'; end if;
  if (select status from public.job_requests where id = req2) <> 'RECRUITING' then raise exception 'C10: status da solicitação'; end if;
  if not exists (select 1 from public.job_request_history where request_id = req2 and event = 'RECRUITMENT_STARTED') then
    raise exception 'C10: histórico da solicitação';
  end if;
  if not exists (select 1 from public.job_events where "jobId" = job2 and type = 'JOB_CREATED'
                   and data->>'requestCode' is not null) then
    raise exception 'C10: evento de criação sem a REQ';
  end if;
  -- A solicitação não foi tocada pelas operações de posição
  if (select openings from public.job_requests where id = req2) <> 2 then raise exception 'C10: solicitação alterada'; end if;
  raise notice 'C10 ok — vínculo REQ ↔ VAG e históricos preservados';

  -- ── Nunca "3 preenchidas de 2" ───────────────────────────────────────────────────────
  if exists (
    select 1 from public.jobs j
     where j."openings" is not null
       and (select count(*) from public.job_positions p where p."jobId" = j.id and p.status = 'FILLED') > j."openings"
  ) then raise exception 'Invariante: preenchidas > posições'; end if;
  raise notice 'Invariante ok — preenchidas ≤ posições em todas as vagas';
end $$;

-- ── Migração dos dados reais (compara com o estado anterior salvo em _pre_openings) ──
-- Só faz sentido quando a migração roda junto (runner com o 2º argumento).
do $$
declare bad int;
begin
  if coalesce(current_setting('test.with_migration', true), 'off') <> 'on' then
    raise notice 'Migração real: pulada (rode com o arquivo da migração para validar o backfill)';
    return;
  end if;

  select count(*) into bad
    from _pre_openings pre
   where not pre.tp
     and (select count(*) from public.job_positions p where p."jobId" = pre.id) <> greatest(coalesce(pre.openings, 1), 1);
  if bad > 0 then raise exception 'Migração: % vaga(s) com número de posições diferente do openings anterior', bad; end if;

  select count(*) into bad from _pre_openings pre
   where pre.tp and exists (select 1 from public.job_positions p where p."jobId" = pre.id);
  if bad > 0 then raise exception 'Migração: banco de talentos ganhou posições'; end if;

  select count(*) into bad from _pre_openings pre
   where (select count(*) from public.applications a where a."jobId" = pre.id) <> pre.apps;
  if bad > 0 then raise exception 'Migração: candidaturas alteradas'; end if;

  select count(*) into bad from _pre_openings pre
   where (select "updatedAt" from public.jobs j where j.id = pre.id) <> pre.updated;
  if bad > 0 then raise exception 'Migração: updatedAt de % vaga(s) foi alterado', bad; end if;

  raise notice 'Migração real ok — % vagas, % posições, % preenchidas',
    (select count(*) from _pre_openings),
    (select count(*) from public.job_positions p join _pre_openings pre on pre.id = p."jobId"),
    (select count(*) from public.job_positions p join _pre_openings pre on pre.id = p."jobId" where p.status = 'FILLED');
end $$;
