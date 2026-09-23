import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleCheck,
  FileSpreadsheet,
  FileWarning,
  Stethoscope,
  TrendingUp,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { needsAttention, sectionStatus } from "@/lib/admissao/document-status";
import {
  activeReportFilterCount,
  attentionItems,
  countBy,
  monthlySeries,
  parseReportFilters,
  REPORT_PERIODS,
  reportFiltersToQuery,
  summarizeReport,
  type AttentionItem,
  type ReportAdmission,
} from "@/lib/admissao/reports";
import { PageHeader } from "@/components/internal/PageHeader";
import { PageContainer } from "@/components/ui/PageContainer";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel, panelLinkClass } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink, buttonVariants } from "@/components/ui/Button";
import { BarList, ColumnChart } from "@/components/ui/charts";
import { TONE_DOT } from "@/components/ui/StatusBadge";
import { ReportFiltersBar } from "@/components/internal/admissao/ReportFiltersBar";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios — RH" };

async function loadReportRows(): Promise<{ rows: ReportAdmission[]; error: boolean }> {
  const supabase = await createClient();
  const [admissionsRes, docTypesRes, attachmentsRes] = await Promise.all([
    supabase
      .from("admissions")
      .select(
        `id, fullName, createdAt, companyId, branchId, positionId, responsibleId, stageId, startDate, medicalExamDate,
         digitalFormToken, digitalFormExpiresAt, digitalFormSubmittedAt,
         position:admission_positions(name), company:admission_companies(name),
         branch:admission_branches(name), stage:admission_stages(name, color, isFinal)`
      )
      .is("deletedAt", null)
      .limit(5000),
    supabase.from("admission_document_types").select("id, required"),
    supabase
      .from("admission_attachments")
      .select("admissionId, documentTypeId, aiStatus, reviewStatus, createdAt")
      .not("documentTypeId", "is", null)
      .limit(50000),
  ]);
  if (admissionsRes.error) return { rows: [], error: true };

  const docTypes = (docTypesRes.data ?? []) as Array<{ id: string; required: boolean }>;
  const required = docTypes.filter((d) => d.required);
  // admissão → tipo de documento → arquivos
  const files = new Map<string, Map<string, Array<{ aiStatus: string | null; reviewStatus: string | null; createdAt: string }>>>();
  for (const f of (attachmentsRes.data ?? []) as Array<{
    admissionId: string;
    documentTypeId: string;
    aiStatus: string | null;
    reviewStatus: string | null;
    createdAt: string;
  }>) {
    let byType = files.get(f.admissionId);
    if (!byType) files.set(f.admissionId, (byType = new Map()));
    const arr = byType.get(f.documentTypeId) ?? [];
    arr.push(f);
    byType.set(f.documentTypeId, arr);
  }

  const rows = ((admissionsRes.data ?? []) as unknown as Array<{
    id: string;
    fullName: string;
    createdAt: string;
    companyId: string | null;
    branchId: string | null;
    positionId: string | null;
    responsibleId: string | null;
    stageId: string | null;
    startDate: string | null;
    medicalExamDate: string | null;
    digitalFormToken: string | null;
    digitalFormExpiresAt: string | null;
    digitalFormSubmittedAt: string | null;
    position: { name: string } | null;
    company: { name: string } | null;
    branch: { name: string } | null;
    stage: { name: string; color: string; isFinal: boolean } | null;
  }>).map<ReportAdmission>((a) => {
    const byType = files.get(a.id);
    return {
      id: a.id,
      fullName: a.fullName,
      createdAt: new Date(a.createdAt).toISOString(),
      companyId: a.companyId,
      companyName: a.company?.name ?? null,
      branchId: a.branchId,
      branchName: a.branch?.name ?? null,
      positionId: a.positionId,
      positionName: a.position?.name ?? null,
      responsibleId: a.responsibleId,
      stageId: a.stageId,
      stageName: a.stage?.name ?? null,
      stageColor: a.stage?.color ?? null,
      isFinal: !!a.stage?.isFinal,
      startDate: a.startDate?.slice(0, 10) ?? null,
      examDate: a.medicalExamDate?.slice(0, 10) ?? null,
      digitalFormToken: !!a.digitalFormToken,
      digitalFormExpiresAt: a.digitalFormExpiresAt,
      digitalFormSubmittedAt: a.digitalFormSubmittedAt,
      requiredDocsTotal: required.length,
      requiredDocsDone: required.filter((d) => (byType?.get(d.id)?.length ?? 0) > 0).length,
      docsToReview: docTypes.filter((d) => {
        const list = byType?.get(d.id);
        return !!list?.length && needsAttention(sectionStatus(list, d.required));
      }).length,
    };
  });
  return { rows, error: false };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, config, { rows, error }] = await Promise.all([searchParams, getAdmissionConfig(), loadReportRows()]);
  const filters = parseReportFilters(params);
  const now = new Date();
  const s = summarizeReport(rows, filters, now);
  const cohort = s.cohort;
  const attention = attentionItems(cohort, now);
  const query = reportFiltersToQuery(filters);
  const period = REPORT_PERIODS.find((p) => p.value === filters.period)!;

  const stageOrder = new Map(config.stages.map((st, i) => [st.id, i]));
  const byStage = countBy(cohort, (r) => ({
    key: r.stageId ?? "none",
    label: r.stageName ?? "Sem etapa",
    color: r.stageColor ?? "#B5BEAA",
  })).sort((a, b) => (stageOrder.get(a.key) ?? 999) - (stageOrder.get(b.key) ?? 999));
  const byCompany = countBy(cohort, (r) => ({ key: r.companyId ?? "none", label: r.companyName ?? "Sem empresa" }));
  const byBranch = countBy(cohort, (r) => ({ key: r.branchId ?? "none", label: r.branchName ?? "Sem filial" }));
  const byPosition = countBy(cohort, (r) => ({ key: r.positionId ?? "none", label: r.positionName ?? "Sem cargo" }));
  const months = monthlySeries(cohort, filters, now);
  const since = s.dataSince ? new Date(s.dataSince).toLocaleDateString("pt-BR") : null;

  return (
    <PageContainer>
      <PageHeader
        className="mb-0"
        icon={BarChart3}
        title="Relatórios"
        subtitle="Indicadores e análise dos processos de admissão."
        action={
          <a
            href={`/api/admissoes/export${query ? `?${query}` : ""}`}
            className={buttonVariants({ variant: "primary" })}
            title="Baixa as admissões do recorte atual em planilha"
          >
            <FileSpreadsheet aria-hidden />
            Exportar Excel
          </a>
        }
      />

      <div className="flex flex-col gap-2">
        <ReportFiltersBar
          filters={filters}
          companies={config.companies}
          branches={config.branches}
          positions={config.positions}
          users={config.users}
        />
        <p className="text-[12.5px] text-wg-ink-muted">
          {plural(cohort.length, "admissão", "admissões")} no recorte · o período considera a data de abertura da admissão
          {filters.period === "tudo" && since ? ` (dados desde ${since})` : ""}.
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-card border border-danger-border bg-danger-bg px-4 py-3 text-body text-danger-fg">
          Não foi possível carregar os dados dos relatórios agora. Atualize a página em instantes.
        </div>
      ) : cohort.length === 0 ? (
        <div className="rounded-card border border-wg-border-lighter bg-white">
          <EmptyState
            icon={BarChart3}
            title="Não existem dados suficientes para este filtro."
            description="Nenhuma admissão foi aberta no recorte selecionado."
            action={
              activeReportFilterCount(filters) > 0 ? (
                <ButtonLink href="/admissoes/relatorios" variant="secondary" size="sm">
                  Limpar filtros
                </ButtonLink>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Admissões ativas"
              value={s.active}
              icon={Users}
              tone="info"
              context={s.activeWithIssues > 0 ? `${s.activeWithIssues} com pendência para o RH` : s.active > 0 ? "Nenhuma com pendência" : undefined}
              hint="Admissões do recorte que ainda não chegaram à etapa de conclusão."
              href="/admissoes"
            />
            <MetricCard
              label="Admissões concluídas"
              value={s.completed}
              icon={CheckCircle2}
              tone="success"
              context={s.created > 0 ? `${Math.round((s.completed / s.created) * 100)}% do recorte` : undefined}
              hint="Admissões do recorte na etapa final da jornada."
            />
            <MetricCard
              label="Novas admissões"
              value={s.created}
              icon={TrendingUp}
              tone="neutral"
              comparison={s.createdDeltaPct !== null ? { deltaPct: s.createdDeltaPct, label: period.compareLabel, goodWhenUp: null } : null}
              context={
                s.createdDeltaPct === null
                  ? filters.period === "tudo"
                    ? since
                      ? `Desde ${since}`
                      : undefined
                    : "Sem base para comparar com o período anterior"
                  : undefined
              }
              hint="Admissões abertas no período. A comparação só aparece quando há dados em todo o período anterior."
            />
            <MetricCard
              label="Filiais com admissão"
              value={s.branches}
              icon={Building2}
              tone="neutral"
              context={config.branches.length ? `de ${plural(config.branches.length, "filial ativa", "filiais ativas")}` : undefined}
            />
            <MetricCard
              label="Pendências documentais"
              value={s.docsPending}
              icon={FileWarning}
              tone={s.docsPending > 0 ? "warning" : "neutral"}
              context={
                s.docsPending > 0
                  ? [s.docsMissing ? `${s.docsMissing} com obrigatórios faltando` : null, s.docsToReview ? `${s.docsToReview} para conferir` : null]
                      .filter(Boolean)
                      .join(" · ")
                  : "Documentação em dia"
              }
              hint="Admissões em andamento com documento obrigatório não enviado ou aguardando conferência."
              href={s.docsMissing > 0 ? "/admissoes?filtro=documentos" : undefined}
            />
            <MetricCard
              label="ASO sem agendamento"
              value={s.examPending}
              icon={Stethoscope}
              tone={s.examPendingSoon > 0 ? "danger" : s.examPending > 0 ? "warning" : "neutral"}
              context={s.examPendingSoon > 0 ? `${s.examPendingSoon} com início em até 7 dias` : s.examPending === 0 ? "Todos agendados" : undefined}
              hint="Admissões em andamento sem data de exame médico (ASO) cadastrada."
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Admissões por mês"
              meta={`${months.length} ${months.length === 1 ? "mês" : "meses"}`}
              description="Quantidade de admissões abertas em cada mês."
            >
              <ColumnChart data={months} unit={["admissão", "admissões"]} ariaLabel="Admissões abertas por mês" />
            </Panel>
            <AttentionPanel items={attention} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="Por etapa" meta={plural(cohort.length, "admissão", "admissões")}>
              <BarList data={byStage} total={cohort.length} />
            </Panel>
            <Panel title="Por empresa">
              <BarList data={byCompany} total={cohort.length} maxItems={6} />
            </Panel>
            <Panel title="Por filial">
              <BarList data={byBranch} total={cohort.length} maxItems={6} />
            </Panel>
            <Panel title="Por cargo">
              <BarList data={byPosition} total={cohort.length} maxItems={6} />
            </Panel>
          </div>

          <p className="text-[12px] text-wg-ink-muted">
            Tempo médio de admissão e cumprimento de prazo ainda não são exibidos: dependem do histórico de etapas, que
            passou a ser registrado agora, e de uma meta de prazo definida pelo RH.
          </p>
        </>
      )}
    </PageContainer>
  );
}

function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const total = new Set(items.flatMap((i) => i.ids)).size;
  return (
    <Panel
      title="Atenção necessária"
      meta={total > 0 ? plural(total, "admissão", "admissões") : undefined}
      description="Situações operacionais que pedem ação do RH."
      flush
    >
      {items.length === 0 ? (
        <EmptyState compact icon={CircleCheck} title="Nenhuma pendência operacional neste recorte." />
      ) : (
        <ul className="divide-y divide-wg-border-lighter">
          {items.map((i) => {
            const href = i.ids.length === 1 ? `/admissoes/${i.ids[0]}` : i.href;
            return (
              <li key={i.key} className="px-5 py-3">
                <div className="flex items-start gap-2.5">
                  <span aria-hidden className={cn("mt-[7px] h-2 w-2 shrink-0 rounded-full", TONE_DOT[i.tone])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-wg-ink">{i.text}</p>
                    <p className="mt-0.5 truncate text-meta text-wg-ink-muted">
                      {i.samples.map((sm, idx) => (
                        <span key={sm.id}>
                          {idx > 0 && ", "}
                          <Link href={`/admissoes/${sm.id}`} className="rounded-sm hover:text-wg-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50">
                            {sm.name.split(" ").slice(0, 2).join(" ")}
                          </Link>
                        </span>
                      ))}
                      {i.count > i.samples.length && ` e mais ${i.count - i.samples.length}`}
                    </p>
                  </div>
                  <Link href={href} className={cn(panelLinkClass, "shrink-0")}>
                    {i.ids.length === 1 ? "Abrir" : "Ver admissões"}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
