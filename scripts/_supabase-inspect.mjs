import { Client } from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("SUPABASE_DB_URL ausente"); process.exit(1); }

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();

  const tables = await client.query(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`
  );
  console.log(`public tables (${tables.rowCount}):`);
  for (const r of tables.rows) console.log("  -", r.tablename);

  const enums = await client.query(
    `select typname from pg_type where typtype = 'e' order by typname`
  );
  console.log(`\nenums (${enums.rowCount}):`, enums.rows.map((r) => r.typname).join(", "));

  const ext = await client.query(
    `select extname from pg_extension where extname in ('vector','pg_trgm','moddatetime','pgcrypto') order by extname`
  );
  console.log("extensions:", ext.rows.map((r) => r.extname).join(", "));

  try {
    const mig = await client.query(
      `select version from supabase_migrations.schema_migrations order by version`
    );
    console.log(`schema_migrations (${mig.rowCount}):`, mig.rows.map((r) => r.version).join(", "));
  } catch {
    console.log("schema_migrations: (tabela não existe)");
  }
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
