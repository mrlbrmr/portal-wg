// Fase 6 — cópia de ARQUIVOS Vercel Blob → Supabase Storage + reescrita das
// colunas de caminho. Rodar DEPOIS de _supabase-copy-data.mjs (que traz
// resumeUrl/blobUrl como as URLs originais do Blob) e DEPOIS de aplicar a
// migração dos buckets (20260720000002_storage.sql).
//
// Para cada currículo (applications.resumeUrl) e anexo de admissão
// (admission_attachments.blobUrl) que ainda seja uma URL http(s) do Blob:
//   1. baixa o arquivo privado do Vercel Blob (get, access:"private");
//   2. sobe para o bucket privado do Supabase Storage;
//   3. atualiza a coluna no Supabase para o CAMINHO do objeto (o que o app usa).
// Idempotente: só processa linhas cujo valor ainda começa com "http".
//
// Requer @vercel/blob TEMPORARIAMENTE instalado (foi removido na Fase 5):
//   npm i -D @vercel/blob
// e as env: SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// BLOB_READ_WRITE_TOKEN (ou credencial OIDC do Blob).
//
// Rodar: node --use-system-ca scripts/_supabase-copy-files.mjs
// Depois de validar, remover o pacote de novo: npm uninstall @vercel/blob

import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { get } from "@vercel/blob";
import { randomUUID } from "node:crypto";

const SB_DB = process.env.SUPABASE_DB_URL;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_DB || !SB_URL || !SB_SERVICE) {
  console.error("Faltam env: SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = new Client({ connectionString: SB_DB, ssl: { rejectUnauthorized: false } });
const sb = createClient(SB_URL, SB_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

function sanitize(name) {
  return (name || "arquivo")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

// Migra uma tabela: baixa do Blob, sobe pro bucket, grava o caminho.
async function migrate({ table, urlCol, nameCol, prefixCol, bucket }) {
  const { rows } = await db.query(
    `select id, "${urlCol}" as url, "${nameCol}" as name, "${prefixCol}" as prefix
       from "${table}"
      where "${urlCol}" is not null and "${urlCol}" like 'http%'`
  );
  console.log(`\n${table}: ${rows.length} arquivo(s) para migrar`);

  let ok = 0;
  for (const r of rows) {
    try {
      const res = await get(r.url, { access: "private" });
      if (!res || res.statusCode !== 200 || !res.stream) throw new Error(`blob get status ${res?.statusCode}`);
      const arrayBuf = await new Response(res.stream).arrayBuffer();
      const contentType = res.blob?.contentType || "application/octet-stream";

      const path = `${r.prefix}/${randomUUID().slice(0, 8)}-${sanitize(r.name)}`;
      const { error: upErr } = await sb.storage
        .from(bucket)
        .upload(path, Buffer.from(arrayBuf), { contentType, upsert: false });
      if (upErr) throw upErr;

      await db.query(`update "${table}" set "${urlCol}" = $1 where id = $2`, [path, r.id]);
      ok++;
      console.log(`  ✓ ${r.id} → ${bucket}/${path}`);
    } catch (e) {
      console.error(`  ✗ ${r.id}: ${e.message}`);
    }
  }
  console.log(`${table}: ${ok}/${rows.length} migrados.`);
}

try {
  await db.connect();
  await migrate({
    table: "applications",
    urlCol: "resumeUrl",
    nameCol: "resumeName",
    prefixCol: "jobId",
    bucket: "resumes",
  });
  await migrate({
    table: "admission_attachments",
    urlCol: "blobUrl",
    nameCol: "fileName",
    prefixCol: "admissionId",
    bucket: "admission-attachments",
  });
  console.log("\n✅ cópia de arquivos concluída.");
} catch (e) {
  console.error("❌ ERRO:", e.message);
  process.exit(1);
} finally {
  await db.end();
}
