// Backfill: garante que toda vaga use inscrição nativa (Tally aposentado em 2026-07).
// Converte qualquer vaga que ainda esteja em EXTERNAL para NATIVE.
// É um no-op seguro e idempotente se já não houver vagas EXTERNAL.
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

// Tenta carregar DATABASE_URL do .env.local quando não estiver no ambiente
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(".env.local", "utf8");
    const match = env.match(/^DATABASE_URL="?([^"\n]+)"?/m);
    if (match && match[1].trim()) process.env.DATABASE_URL = match[1].trim();
  } catch {
    // sem .env.local — ok se DATABASE_URL já estiver no ambiente (ex: Vercel)
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrado. Configure em .env.local ou como variável de ambiente.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function run() {
  const result = await prisma.job.updateMany({
    where: { applyMode: "EXTERNAL" },
    data: { applyMode: "NATIVE" },
  });

  if (result.count === 0) {
    console.log("Backfill applyMode: nenhuma vaga em EXTERNAL. Nada a fazer.");
  } else {
    console.log(`Backfill applyMode: ${result.count} vaga(s) convertida(s) de EXTERNAL para NATIVE.`);
  }

  await prisma.$disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
