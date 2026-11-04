-- Modelos de processo: seed do modelo padrão, gravação atômica (modelo e vaga), ordem
-- própria da vaga, procedência e unicidade do padrão. Transação com ROLLBACK:
--   node scripts/run-sql-test.mjs scripts/test-process-templates.sql [supabase/migrations/20261104120000_process_templates.sql]
do $$
declare
  def_id text;
  tpl text;
  job_a text;
  n int;
  first_id text;
  failed boolean;
begin
  -- ── 1. Seed: um modelo padrão com todas as etapas ativas ──────────────────────────
  select count(*) into n from public.process_templates where "isDefault";
  if n <> 1 then raise exception 'C1: esperava 1 modelo padrão, achei %', n; end if;
  select id into def_id from public.process_templates where "isDefault";
  select count(*) into n from public.process_template_stages where "templateId" = def_id;
  if n <> (select count(*) from public.application_stages where active) then
    raise exception 'C1: modelo padrão não tem todas as etapas ativas (%)', n;
  end if;
  raise notice 'C1 ok — modelo padrão cobre todas as etapas ativas';

  -- ── 2. Só um padrão ───────────────────────────────────────────────────────────────
  failed := false;
  begin
    insert into public.process_templates (name, "isDefault") values ('Outro padrão', true);
  exception when unique_violation then failed := true;
  end;
  if not failed then raise exception 'C2: aceitou dois modelos padrão'; end if;
  raise notice 'C2 ok — segundo padrão recusado';

  -- ── 3. Modelo: gravação atômica e ordem ───────────────────────────────────────────
  insert into public.process_templates (name) values ('Teste Operacional') returning id into tpl;
  perform public.process_template_set_stages(tpl, array['NEW', 'INTERVIEW', 'SCREENING']);
  select "stageId" into first_id from public.process_template_stages where "templateId" = tpl order by "sortOrder" limit 1;
  select count(*) into n from public.process_template_stages where "templateId" = tpl;
  if n <> 3 or first_id <> 'NEW' then raise exception 'C3: ordem/contagem do modelo incorreta'; end if;
  if (select "stageId" from public.process_template_stages where "templateId" = tpl order by "sortOrder" offset 1 limit 1) <> 'INTERVIEW' then
    raise exception 'C3: ordem do modelo não respeita a lista';
  end if;
  perform public.process_template_set_stages(tpl, array['NEW', 'SCREENING']);
  select count(*) into n from public.process_template_stages where "templateId" = tpl;
  if n <> 2 then raise exception 'C3: regravar não substituiu a lista (%)', n; end if;
  raise notice 'C3 ok — lista do modelo substituída por inteiro, na ordem dada';

  -- ── 4. Vaga: copia etapas com ordem própria + procedência ─────────────────────────
  select id into job_a from public.jobs limit 1;
  if job_a is null then raise notice 'C4 pulado — sem vagas no banco'; return; end if;
  perform public.job_process_set(job_a, array['NEW', 'SCREENING', 'INTERVIEW'], tpl);
  select count(*) into n from public.job_stage_config where "jobId" = job_a;
  if n <> 3 then raise exception 'C4: vaga deveria ter 3 etapas, tem %', n; end if;
  if (select "stageId" from public.job_stage_config where "jobId" = job_a order by "sortOrder" offset 2 limit 1) <> 'INTERVIEW' then
    raise exception 'C4: ordem própria da vaga incorreta';
  end if;
  if (select "processTemplateId" from public.jobs where id = job_a) is distinct from tpl then
    raise exception 'C4: procedência não gravada';
  end if;
  raise notice 'C4 ok — vaga com 3 etapas na ordem própria e procedência gravada';

  -- Editar o modelo depois NÃO muda a vaga (cópia).
  perform public.process_template_set_stages(tpl, array['NEW']);
  select count(*) into n from public.job_stage_config where "jobId" = job_a;
  if n <> 3 then raise exception 'C5: editar o modelo alterou a vaga'; end if;
  raise notice 'C5 ok — editar o modelo não altera a vaga';

  -- ── 6. Redefinir: lista vazia volta ao padrão e limpa a procedência ───────────────
  perform public.job_process_set(job_a, array[]::text[], null);
  select count(*) into n from public.job_stage_config where "jobId" = job_a;
  if n <> 0 then raise exception 'C6: redefinir não limpou as etapas da vaga'; end if;
  if (select "processTemplateId" from public.jobs where id = job_a) is not null then
    raise exception 'C6: procedência não foi limpa';
  end if;
  raise notice 'C6 ok — vaga volta a seguir o modelo padrão';

  -- ── 7. Excluir o modelo não apaga a vaga nem as etapas dela ───────────────────────
  perform public.job_process_set(job_a, array['NEW', 'SCREENING'], tpl);
  delete from public.process_templates where id = tpl;
  if (select "processTemplateId" from public.jobs where id = job_a) is not null then
    raise exception 'C7: procedência deveria virar null ao excluir o modelo';
  end if;
  select count(*) into n from public.job_stage_config where "jobId" = job_a;
  if n <> 2 then raise exception 'C7: excluir o modelo mexeu nas etapas da vaga'; end if;
  raise notice 'C7 ok — excluir o modelo preserva a vaga';
end $$;
