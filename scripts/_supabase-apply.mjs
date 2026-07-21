import { Client } from "pg";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("SUPABASE_DB_URL ausente"); process.exit(1); }

const file = process.argv[2];
const version = process.argv[3]; // opcional: registra em schema_migrations
if (!file) { console.error("uso: node _supabase-apply.mjs <arquivo.sql> [version]"); process.exit(1); }

const sql = readFileSync(file, "utf8");
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  // Simple-query protocol: string multi-statement roda como UMA transação implícita
  // (rollback total se qualquer statement falhar).
  await client.query(sql);
  console.log("✅ migration aplicada:", file);

  if (version) {
    await client.query(
      `insert into supabase_migrations.schema_migrations (version, name)
       values ($1, $2)
       on conflict (version) do nothing`,
      [version, "init"]
    );
    console.log("✅ registrada em schema_migrations:", version);
  }
} catch (e) {
  console.error("❌ ERRO:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
