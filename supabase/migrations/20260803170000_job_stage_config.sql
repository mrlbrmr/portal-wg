-- Configuração de etapas por vaga.
-- Se não houver linhas para uma vaga, ela usa todas as etapas globais ativas (padrão).
create table if not exists "job_stage_config" (
  "jobId"   text not null references "jobs"("id") on delete cascade,
  "stageId" text not null references "application_stages"("id") on delete cascade,
  primary key ("jobId", "stageId")
);

alter table "job_stage_config" enable row level security;

create policy "staff lê job_stage_config" on "job_stage_config"
  for select using (is_staff());

create policy "admin edita job_stage_config" on "job_stage_config"
  for all using (is_admin());
