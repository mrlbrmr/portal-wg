// Backfill: gera slug para vagas que ainda não têm.
// É um no-op seguro se já não houver vagas sem slug.
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

function generateSlug(title, city) {
  const accentMap = {
    "á":"a","à":"a","ã":"a","â":"a","ä":"a",
    "é":"e","è":"e","ê":"e","ë":"e",
    "í":"i","ì":"i","î":"i","ï":"i",
    "ó":"o","ò":"o","õ":"o","ô":"o","ö":"o",
    "ú":"u","ù":"u","û":"u","ü":"u",
    "ç":"c","ñ":"n",
  };
  return `${title} ${city}`
    .toLowerCase()
    .replace(/[áàãâäéèêëíìîïóòõôöúùûüçñ]/g, (c) => accentMap[c] ?? c)
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

async function run() {
  const jobs = await prisma.job.findMany({
    where: { slug: null },
    select: { id: true, title: true, city: true },
  });

  if (jobs.length === 0) {
    console.log("Backfill de slugs: nenhuma vaga sem slug. Nada a fazer.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Backfill de slugs: ${jobs.length} vagas sem slug encontradas.`);

  for (const job of jobs) {
    const baseSlug = generateSlug(job.title, job.city);
    let slug = baseSlug;
    let counter = 1;

    while (await prisma.job.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++counter}`;
    }

    await prisma.job.update({ where: { id: job.id }, data: { slug } });
    console.log(`  ✓ "${job.title}" → ${slug}`);
  }

  console.log("Backfill concluído.");
  await prisma.$disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
