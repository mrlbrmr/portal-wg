import { Client } from "pg";

const neon = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sb = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

await neon.connect();
await sb.connect();

const email = "murilo.bremer@wgbaterias.com.br";
const n = await neon.query(`select "passwordHash" from users where email = $1`, [email]);
const s = await sb.query(`select encrypted_password, aud, role, email_confirmed_at is not null as confirmed from auth.users where email = $1`, [email]);

const neonHash = n.rows[0]?.passwordHash ?? "(vazio)";
const sbHash = s.rows[0]?.encrypted_password ?? "(vazio/null)";

console.log("Neon  passwordHash    :", neonHash.slice(0, 12), "... len", neonHash.length);
console.log("SB    encrypted_password:", String(sbHash).slice(0, 12), "... len", String(sbHash).length);
console.log("iguais?", neonHash === sbHash);
console.log("SB aud/role/confirmed  :", s.rows[0]?.aud, s.rows[0]?.role, s.rows[0]?.confirmed);

await neon.end();
await sb.end();
