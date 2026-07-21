// Semeia vagas SINTÉTICAS (sem PII) no Supabase para validar a Fase 4.
import { Client } from "pg";
const sb = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await sb.connect();

await sb.query(`delete from jobs where id like 'seed_%'`);
await sb.query(
  `insert into jobs (id,title,department,city,state,modality,"contractType",description,responsibilities,"requiredRequirements",status,"createdAt")
   values
   ('seed_1','Vendedor Externo','Comercial','Campinas','SP','PRESENTIAL','CLT','<p>Vaga sintetica de teste.</p>','<p>Vender.</p>','<p>Experiencia.</p>','ACTIVE', now() - interval '2 days'),
   ('seed_2','Analista de Logística','Logística','Curitiba','PR','HYBRID','CLT','<p>Vaga sintetica de teste.</p>','<p>Coordenar.</p>','<p>Excel.</p>','ACTIVE', now() - interval '5 days'),
   ('seed_3','Estágio Financeiro (rascunho)','Financeiro','Sorocaba','SP','PRESENTIAL','INTERNSHIP','<p>Rascunho.</p>','<p>Apoiar.</p>','<p>Cursando.</p>','DRAFT', now())`
);
const c = await sb.query(`select status, count(*) from jobs where id like 'seed_%' group by status`);
console.log("vagas sintéticas:", c.rows.map((r) => `${r.status}=${r.count}`).join(", "));
await sb.end();
