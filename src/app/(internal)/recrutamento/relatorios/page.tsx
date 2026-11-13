import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Clock, Inbox, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { labelForSource, loadSourceLabels } from "@/lib/application-sources";
import { REPORT_PERIODS, type ReportPeriod } from "@/lib/admissao/reports";
import { jobLifecycle } from "@/lib/recruitment/job-presentation";
import {
  FUNNEL_LABELS,
  MIN_BASE_RATE,
  MIN_BASE_SOURCE_RATE,
  MIN_BASE_TIME,
  buildRecruitmentReport,
  type ReportInput,
} from "@/lib/recruitment/recruitment-report";
import { PageHeader } from "@/components/internal/PageHeader";
import { PageContainer } from "@/components/ui/PageContainer";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios de recrutamento — RH" };

const PERIODS = REPORT_PERIODS.filter((p) => p.value !== "ano");

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}

/**
 * O Supabase devolve no máximo 1000 linhas por consulta: lê em páginas até acabar, para o
 * relatório não ficar cortado quando o histórico crescer.
 */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  size = 1000
): Promise<{ data: T[]; error: boolean }> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) return { data: out, error: true };
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) return { data: out, error: false };
  }
}

async function loadInput(): Promise<{
  input: ReportInput;
  labels: Record<string, string>;
  jobMeta: Record<string, string>;
  error: boolean;
}> {
  const supabase = await createClient();
  const [jobsRes, stagesRes, appsRes, historyRes, admissionsRes, positionsRes, statusRes, labels] = await Promise.all([
    supabase.from("jobs").select("id, code, title, city, state, isTalentPool, createdAt").limit(2000),
    supabase.from("application_stages").select("id, kind"),
    fetchAll<ReportInput["applications"][number]>((a, b) =>
      supabase.from("applications").select("id, jobId, source, createdAt, stageId").order("id").range(a, b)
    ),
    fetchAll<ReportInput["history"][number]>((a, b) =>
      supabase.from("application_stage_history").select("applicationId, stageId").order("id").range(a, b)
    ),
    supabase.from("admissions").select("sourceApplicationId").not("sourceApplicationId", "is", null).is("deletedAt", null),
    supabase.from("job_positions").select("id, jobId, status, filledAt").limit(5000),
    supabase.from("job_status_history").select("jobId, status, changedAt").order("changedAt", { ascending: true }).limit(10000),
    loadSourceLabels(supabase),
  ]);
  const error =
    appsRes.error || historyRes.error || [jobsRes, stagesRes, admissionsRes, positionsRes, statusRes].some((r) => r.error);

  const jobs = (jobsRes.data ?? []) as Array<{
    id: string; code: string | null; title: string; city: string | null; state: string | null; isTalentPool: boolean; createdAt: string;
  }>;
  // Processos com o mesmo título se distinguem pelo código e pela cidade.
  const jobMeta: Record<string, string> = Object.fromEntries(
    jobs.map((j) => [j.id, [j.code, j.city ? `${j.city}${j.state ? `/${j.state}` : ""}` : null].filter(Boolean).join(" · ")])
  );
  // Abertura = 1ª passagem para um status aberto; sem histórico, a criação da vaga.
  const jobOpenedAt: Record<string, string> = Object.fromEntries(jobs.map((j) => [j.id, j.createdAt]));
  const seen = new Set<string>();
  for (const h of (statusRes.data ?? []) as Array<{ jobId: string; status: string; changedAt: string }>) {
    if (seen.has(h.jobId) || jobLifecycle(h.status) !== "OPEN") continue;
    seen.add(h.jobId);
    jobOpenedAt[h.jobId] = h.changedAt;
  }

  return {
    error,
    labels,
    jobMeta,
    input: {
      jobs,
      stages: (stagesRes.data ?? []) as ReportInput["stages"],
      applications: appsRes.data,
      history: historyRes.data,
      hiredApplicationIds: ((admissionsRes.data ?? []) as Array<{ sourceApplicationId: string }>).map((a) => a.sourceApplicationId),
      positions: (positionsRes.data ?? []) as ReportInput["positions"],
      jobOpenedAt,
    },
  };
}

export default async function RecruitmentReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const params = await searchParams;
  const period: ReportPeriod = PERIODS.some((p) => p.value === params.periodo) ? (params.periodo as ReportPeriod) : "90d";
  const { input, labels, jobMeta, error } = await loadInput();
  const r = buildRecruitmentReport(input, period, new Date());
  const hiredCount = r.funnel.find((f) => f.key === "hired")?.count ?? 0;
  const smallBase = r.received < MIN_BASE_RATE;

  return (
    <PageContainer className="flex flex-col gap-5">
      <PageHeader
        title="Relatórios de recrutamento"
        subtitle="Funil, contratações e origens das candidaturas no período. Tempo por etapa fica no WG Jornada."
      />

      <nav aria-label="Período" className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/recrutamento/relatorios?periodo=${p.value}`}
            aria-current={p.value === period ? "page" : undefined}
            className={cn(
              "rounded-control border px-3 py-1.5 text-meta font-semibold transition-colors",
              p.value === period
                ? "border-wg-ink bg-wg-ink text-white"
                : "border-wg-border-light bg-white text-wg-ink-secondary hover:bg-wg-bg"
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {error && (
        <div role="alert" className="rounded-card border border-danger-border bg-danger-bg px-4 py-3 text-body text-danger-fg">
          Parte dos dados não carregou. Os números abaixo podem estar incompletos; atualize a página em instantes.
        </div>
      )}

      {r.received === 0 && r.hires === 0 ? (
        <div className="rounded-card border border-wg-border-lighter bg-white">
          <EmptyState
            icon={BarChart3}
            title="Não existem dados suficientes para este período."
            description="Nenhuma candidatura recebida e nenhuma posição preenchida no recorte."
          />
        </div>
      ) : (
        <>
          <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              label="Candidaturas recebidas"
              value={r.received}
              icon={Inbox}
              tone="info"
              context={r.talentPoolReceived > 0 ? `+ ${plural(r.talentPoolReceived, "no banco de talentos", "no banco de talentos")}` : undefined}
              hint="Candidaturas criadas no período, sem a vaga contínua do banco de talentos."
            />
            <MetricCard
              label="Candidaturas contratadas"
              value={hiredCount}
              icon={UserCheck}
              tone="success"
              context={smallBase ? "Base pequena para percentual" : `${r.funnel.find((f) => f.key === "hired")?.pct}% das recebidas`}
              hint="Das candidaturas do período, as que chegaram à etapa de aprovado/contratado ou têm admissão ligada."
            />
            <MetricCard
              label="Posições preenchidas"
              value={r.hires}
              icon={BarChart3}
              tone="neutral"
              hint="Posições de vaga preenchidas no período (contratações registradas pelo Contratar)."
            />
            <MetricCard
              label="Dias até preencher (mediana)"
              value={r.medianDaysToFill === null ? "—" : Math.round(r.medianDaysToFill)}
              icon={Clock}
              tone="neutral"
              context={r.medianDaysToFill === null ? `Base pequena (menos de ${MIN_BASE_TIME} posições)` : "Da abertura da vaga ao preenchimento"}
              hint="Mediana dos dias entre a abertura da vaga e o preenchimento de cada posição no período."
            />
          </section>

          <Panel
            title="Funil do período"
            meta={plural(r.received, "candidatura", "candidaturas")}
            description={
              smallBase
                ? `Percentuais aparecem a partir de ${MIN_BASE_RATE} candidaturas no período.`
                : "Cumulativo: quem chegou a uma faixa conta também nas anteriores."
            }
          >
            <ol className="flex flex-col gap-3 px-5 pb-5">
              {r.funnel.map((f) => {
                const width = r.received > 0 ? Math.max(2, Math.round((f.count / r.received) * 100)) : 0;
                return (
                  <li key={f.key}>
                    <div className="flex items-baseline justify-between gap-3 text-body">
                      <span className="text-wg-ink" title={FUNNEL_LABELS[f.key].hint}>
                        {FUNNEL_LABELS[f.key].label}
                      </span>
                      <span className="tabular-nums text-wg-ink">
                        <strong>{f.count.toLocaleString("pt-BR")}</strong>
                        {f.pct !== null && f.key !== "received" && <span className="ml-1.5 text-wg-ink-muted">{f.pct}%</span>}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-wg-bg" aria-hidden>
                      <div className="h-2 rounded-full bg-wg-green" style={{ width: `${width}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel
              title="Por origem"
              description={`Taxa de contratação a partir de ${MIN_BASE_SOURCE_RATE} candidaturas da origem.`}
              flush
            >
              <ReportTable
                headers={["Origem", "Candidaturas", "Contratadas", "Taxa"]}
                rows={r.bySource.map((s) => [
                  labelForSource(labels, s.source),
                  s.received,
                  s.hired,
                  s.rate === null ? "base pequena" : `${s.rate}%`,
                ])}
                empty="Nenhuma candidatura no período."
              />
            </Panel>

            <Panel title="Por vaga" description="Vagas com candidaturas ou posições preenchidas no período." flush>
              <ReportTable
                headers={["Vaga", "Candidaturas", "Contratadas", "Preenchidas", "Dias até preencher"]}
                rows={r.byJob.map((j) => [
                  <span key={j.jobId} className="block">
                    <Link href={`/vagas/${j.jobId}/candidatos`} className="font-medium text-wg-ink hover:underline">
                      {j.title}
                    </Link>
                    {jobMeta[j.jobId] && <span className="block text-meta text-wg-ink-muted">{jobMeta[j.jobId]}</span>}
                  </span>,
                  j.received,
                  j.hired,
                  j.filled,
                  j.medianDaysToFill === null ? (j.filled > 0 ? "base pequena" : "—") : Math.round(j.medianDaysToFill),
                ])}
                empty="Nenhuma vaga com movimento no período."
              />
            </Panel>
          </div>
        </>
      )}
    </PageContainer>
  );
}

function ReportTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
  empty: string;
}) {
  if (rows.length === 0) return <p className="px-5 py-8 text-center text-meta text-wg-ink-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-body">
        <thead>
          <tr className="border-b border-wg-border-lighter text-label uppercase tracking-[0.06em] text-wg-ink-muted">
            {headers.map((h, i) => (
              <th key={h} scope="col" className={cn("px-5 py-2.5 font-semibold", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-wg-border-lighter">
          {rows.map((cells, ri) => (
            <tr key={ri}>
              {cells.map((c, ci) => (
                <td key={ci} className={cn("px-5 py-2.5", ci > 0 ? "text-right tabular-nums text-wg-ink-secondary" : "text-wg-ink")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
