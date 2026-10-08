import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  JORNADA_ADMISSION_COLUMNS,
  JORNADA_JOB_COLUMNS,
  buildJornadaFeed,
  jobInScope,
  parseSince,
  type AdmissionRow,
  type ApplicationRow,
  type JobRow,
  type PositionRow,
  type StageHistoryRow,
  type StageRow,
  type StatusHistoryRow,
} from "@/lib/jobs/jornada-feed";

// GET /api/jornada/sync?desde=AAAA-MM-DD — dados do recrutamento para o WG Jornada
// (app local do G&G que acompanha admissão, experiência e pesquisas de onboarding).
//
// Chamada SERVIDOR A SERVIDOR / app desktop: `Authorization: Bearer <JORNADA_API_TOKEN>`.
// Sem o token a rota nem consulta o banco. Somente leitura. Contrato e regras puras em
// src/lib/jobs/jornada-feed.ts (testado): funil só com quantidades; dado pessoal só de
// quem foi contratado (admissão ligada à vaga).
//
// Usa o client service-role porque não há sessão de usuário: a autorização é o token.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = 1000;
const IN_CHUNK = 150;

function authorized(req: NextRequest, secret: string): boolean {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

type Db = ReturnType<typeof createAdminClient>;

/** Lê todas as linhas (o PostgREST devolve no máximo 1000 por vez). */
async function selectAll<T>(make: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** `in (...)` em lotes, para não estourar o tamanho da URL. */
async function selectIn<T>(db: Db, table: string, columns: string, column: string, ids: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    out.push(...(await selectAll<T>((from, to) => db.from(table).select(columns).in(column, chunk).range(from, to))));
  }
  return out;
}

export async function GET(req: NextRequest) {
  const secret = process.env.JORNADA_API_TOKEN;
  if (!secret) {
    console.warn("[jornada] defina JORNADA_API_TOKEN na Vercel para liberar a sincronização com o WG Jornada.");
    return NextResponse.json({ error: "JORNADA_API_TOKEN não configurado." }, { status: 503 });
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const since = parseSince(req.nextUrl.searchParams.get("desde"));
  try {
    const db = createAdminClient();
    const allJobs = await selectAll<JobRow>((from, to) =>
      db.from("jobs").select(JORNADA_JOB_COLUMNS).eq("isTalentPool", false).order("createdAt").range(from, to)
    );
    const jobs = allJobs.filter((j) => jobInScope(j, since));
    const jobIds = jobs.map((j) => j.id);

    const [stages, statusHistory, positions, apps] = await Promise.all([
      selectAll<StageRow>((from, to) =>
        db.from("application_stages").select('id, name, "sortOrder", kind, "hideFromBoard"').range(from, to)
      ),
      selectIn<StatusHistoryRow>(db, "job_status_history", '"jobId", status, "changedAt"', "jobId", jobIds),
      selectIn<PositionRow>(
        db,
        "job_positions",
        '"jobId", "positionNumber", status, "applicationId", "admissionId", "candidateName", "expectedStartDate", "filledAt", "cancelledAt", "cancelReason"',
        "jobId",
        jobIds
      ),
      selectIn<ApplicationRow>(db, "applications", 'id, "jobId", "stageId", source, "createdAt"', "jobId", jobIds),
    ]);

    const [stageHistory, admByJob, admByPosition] = await Promise.all([
      selectIn<StageHistoryRow>(db, "application_stage_history", '"applicationId", "stageId", "changedAt"', "applicationId", apps.map((a) => a.id)),
      selectIn<AdmissionRow>(db, "admissions", JORNADA_ADMISSION_COLUMNS, "sourceJobId", jobIds),
      selectIn<AdmissionRow>(db, "admissions", JORNADA_ADMISSION_COLUMNS, "id",
        positions.map((p) => p.admissionId).filter((x): x is string => !!x)),
    ]);
    const admissions = [...new Map([...admByJob, ...admByPosition].map((a) => [a.id, a])).values()];

    const body = buildJornadaFeed({ since, jobs, stages, statusHistory, positions, apps, stageHistory, admissions });
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[jornada] falha ao montar a sincronização", err);
    return NextResponse.json({ error: "Falha ao montar a sincronização." }, { status: 500 });
  }
}
