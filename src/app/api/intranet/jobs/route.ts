import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { createAdminClient } from "@/lib/supabase/admin";
import { onlyIntranetVisible } from "@/lib/jobs-query";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  INTRANET_JOB_COLUMNS,
  firstOpenedAtByJob,
  sortByPublishedDesc,
  toIntranetJob,
  type IntranetJobRow,
  type IntranetJobsResponse,
} from "@/lib/jobs/intranet-feed";

// GET /api/intranet/jobs — vagas abertas para Vagas Internas da Intranet WG Conecta.
//
// Chamada SERVIDOR A SERVIDOR: a Intranet envia `Authorization: Bearer <INTRANET_API_TOKEN>`
// (o mesmo valor configurado nas duas Vercel). Sem o token a rota nem consulta o banco —
// vagas "Somente Intranet" não podem sair num endereço público.
//
// A regra de "vaga apta" fica toda aqui: status aberto + inscrições no prazo + visibilidade
// BOTH/INTERNAL. Banco de talentos fica de fora (não é uma oportunidade específica).
// Encerrar, pausar ou trocar para "Somente Portal" tira a vaga da Intranet no próximo ciclo.

export const dynamic = "force-dynamic";

function authorized(req: NextRequest, secret: string): boolean {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function GET(req: NextRequest) {
  const secret = process.env.INTRANET_API_TOKEN;
  if (!secret) {
    console.warn("[intranet] defina INTRANET_API_TOKEN na Vercel para liberar Vagas Internas.");
    return NextResponse.json({ error: "INTRANET_API_TOKEN não configurado." }, { status: 503 });
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    // Vagas pelo cliente anônimo: a RLS (jobs_public_select) já garante status público.
    const { data, error } = await onlyIntranetVisible(
      createAnonClient().from("jobs").select(INTRANET_JOB_COLUMNS).eq("isTalentPool", false)
    );
    if (error) throw error;
    const rows = (data ?? []) as IntranetJobRow[];

    // Data de publicação real: o histórico de status é interno (RLS de staff), então lemos
    // só jobId/status/data, das vagas já filtradas acima.
    let openedAt = new Map<string, string>();
    if (rows.length > 0) {
      const history = await createAdminClient()
        .from("job_status_history")
        .select("jobId, status, changedAt")
        .in("jobId", rows.map((r) => r.id));
      if (history.error) console.warn("[intranet] histórico de status indisponível", history.error.message);
      openedAt = firstOpenedAtByJob(
        (history.data ?? []) as Array<{ jobId: string; status: string; changedAt: string }>
      );
    }

    const baseUrl = getAppBaseUrl();
    const jobs = sortByPublishedDesc(rows.map((r) => toIntranetJob(r, openedAt.get(r.id), baseUrl)));
    const body: IntranetJobsResponse = { generatedAt: new Date().toISOString(), count: jobs.length, jobs };

    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[intranet] falha ao listar vagas", err);
    return NextResponse.json({ error: "Falha ao listar vagas." }, { status: 500 });
  }
}
