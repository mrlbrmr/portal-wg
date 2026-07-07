import { readFileSync } from "fs";
import { execSync } from "child_process";

const env = readFileSync(".env.local", "utf8");
const match = env.match(/^DATABASE_URL="?([^"\n]+)"?/m);
if (!match) { console.error("DATABASE_URL not found in .env.local"); process.exit(1); }

process.env.DATABASE_URL = match[1].trim();
execSync("npx prisma db push", { stdio: "inherit", env: process.env });
