// Relatórios de Admissões — módulo PURO (página, exportação e testes).
//
// Recorte: filtros de cadastro (empresa, filial, cargo, responsável, situação) + PERÍODO,
// que considera a data de ABERTURA da admissão (createdAt). Todos os números, gráficos e
// alertas da página saem do mesmo recorte.
//
// Indicadores que NÃO são calculados (e por quê), para não exibir número inventado:
//   • Tempo médio de admissão e admissões dentro do prazo — exigem a data em que a
//     admissão chegou à etapa final e uma meta de prazo. A mudança de etapa passou a ser
//     registrada em admission_activity_log (STAGE_CHANGED / ADMISSION_COMPLETED); com
//     esse histórico acumulado e uma meta definida (ADMISSION_TARGET_DAYS), dá para
//     calcular sem estimativa. Até lá os cards não aparecem.

import { DIGITAL_FORM_EXPIRY_DAYS } from "./form-config";
import { daysUntilStart, digitalFormState, type DigitalFormState } from "./overview";

/** Meta de dias entre abertura e conclusão. null = não definida (card "dentro do prazo" oculto). */
export const ADMISSION_TARGET_DAYS: number | null = null;

export type ReportPeriod = "30d" | "90d" | "6m" | "12m" | "ano" | "tudo";
export type ReportStatus = "" | "ativas" | "concluidas";

export const REPORT_PERIODS: Array<{ value: ReportPeriod; label: string; compareLabel: string }> = [
  { value: "tudo", label: "Todo o período", compareLabel: "" },
  { value: "30d", label: "Últimos 30 dias", compareLabel: "vs. 30 dias anteriores" },
  { value: "90d", label: "Últimos 90 dias", compareLabel: "vs. 90 dias anteriores" },
  { value: "6m", label: "Últimos 6 meses", compareLabel: "vs. 6 meses anteriores" },
  { value: "12m", label: "Últimos 12 meses", compareLabel: "vs. 12 meses anteriores" },
  { value: "ano", label: "Este ano", compareLabel: "vs. mesmo período do ano passado" },
];

export interface ReportFilters {
  period: ReportPeriod;
  company: string;
  branch: string;
  position: string;
  responsible: string;
  status: ReportStatus;
}

export const EMPTY_REPORT_FILTERS: ReportFilters = {
  period: "tudo",
  company: "",
  branch: "",
  position: "",
  responsible: "",
  status: "",
};

/** Lê os filtros da URL (?periodo=&empresa=&filial=&cargo=&resp=&status=). */
export function parseReportFilters(p: Record<string, string | undefined>): ReportFilters {
  const period = REPORT_PERIODS.some((x) => x.value === p.periodo) ? (p.periodo as ReportPeriod) : "tudo";
  const status: ReportStatus = p.status === "ativas" || p.status === "concluidas" ? p.status : "";
  const id = (v: string | undefined) => (v && /^[\w-]{1,64}$/.test(v) ? v : "");
  return {
    period,
    company: id(p.empresa),
    branch: id(p.filial),
    position: id(p.cargo),
    responsible: id(p.resp),
    status,
  };
}

export function reportFiltersToQuery(f: ReportFilters): string {
  const p = new URLSearchParams();
  if (f.period !== "tudo") p.set("periodo", f.period);
  if (f.company) p.set("empresa", f.company);
  if (f.branch) p.set("filial", f.branch);
  if (f.position) p.set("cargo", f.position);
  if (f.responsible) p.set("resp", f.responsible);
  if (f.status) p.set("status", f.status);
  return p.toString();
}

export function activeReportFilterCount(f: ReportFilters): number {
  return (
    (f.period !== "tudo" ? 1 : 0) +
    [f.company, f.branch, f.position, f.responsible, f.status].filter(Boolean).length
  );
}

/** Janela do período e a janela anterior de mesmo tamanho (para comparação). */
export function periodWindow(period: ReportPeriod, now: Date): { from: Date | null; prevFrom: Date | null; prevTo: Date | null } {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  switch (period) {
    case "30d":
    case "90d": {
      const days = period === "30d" ? 30 : 90;
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
      return { from, prevFrom: new Date(from.getFullYear(), from.getMonth(), from.getDate() - days), prevTo: from };
    }
    case "6m":
    case "12m": {
      const months = period === "6m" ? 6 : 12;
      const from = new Date(today.getFullYear(), today.getMonth() - months + 1, 1);
      return { from, prevFrom: new Date(from.getFullYear(), from.getMonth() - months, 1), prevTo: from };
    }
    case "ano": {
      const from = new Date(today.getFullYear(), 0, 1);
      const prevFrom = new Date(today.getFullYear() - 1, 0, 1);
      const prevTo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1);
      return { from, prevFrom, prevTo };
    }
    default:
      return { from: null, prevFrom: null, prevTo: null };
  }
}

// ─── Linhas e indicadores ────────────────────────────────────────────────────

export interface ReportAdmission {
  id: string;
  fullName: string;
  createdAt: string; // ISO
  companyId: string | null;
  companyName: string | null;
  branchId: string | null;
  branchName: string | null;
  positionId: string | null;
  positionName: string | null;
  responsibleId: string | null;
  stageId: string | null;
  stageName: string | null;
  stageColor: string | null;
  isFinal: boolean;
  startDate: string | null; // AAAA-MM-DD
  examDate: string | null;
  digitalFormToken: boolean;
  digitalFormExpiresAt: string | null;
  digitalFormSubmittedAt: string | null;
  requiredDocsTotal: number;
  requiredDocsDone: number;
  /** Tipos de documento cujo arquivo mais recente pede conferência do RH. */
  docsToReview: number;
}

/** Aplica os filtros de cadastro e situação (o período fica de fora — ver cohort). */
export function applyReportFilters(rows: ReportAdmission[], f: ReportFilters): ReportAdmission[] {
  return rows.filter(
    (r) =>
      (!f.company || r.companyId === f.company) &&
      (!f.branch || r.branchId === f.branch) &&
      (!f.position || r.positionId === f.position) &&
      (!f.responsible || (f.responsible === "none" ? !r.responsibleId : r.responsibleId === f.responsible)) &&
      (!f.status || (f.status === "concluidas" ? r.isFinal : !r.isFinal))
  );
}

function inWindow(iso: string, from: Date | null, to: Date | null): boolean {
  const t = new Date(iso).getTime();
  return (!from || t >= from.getTime()) && (!to || t < to.getTime());
}

export interface AdmissionSignals {
  form: DigitalFormState;
  /** Dias desde o envio do link (derivado do vencimento − validade). */
  formWaitingDays: number | null;
  startDays: number | null;
  missingDocs: boolean;
  late: boolean;
  startSoon: boolean;
}

export function admissionSignals(r: ReportAdmission, now: Date): AdmissionSignals {
  const form = digitalFormState(
    { digitalFormToken: r.digitalFormToken ? "1" : null, digitalFormExpiresAt: r.digitalFormExpiresAt, digitalFormSubmittedAt: r.digitalFormSubmittedAt },
    now
  );
  const sentAt = r.digitalFormExpiresAt
    ? new Date(r.digitalFormExpiresAt).getTime() - DIGITAL_FORM_EXPIRY_DAYS * 86_400_000
    : null;
  const startDays = r.startDate ? daysUntilStart(r.startDate, now) : null;
  return {
    form,
    formWaitingDays: form === "WAITING" && sentAt ? Math.floor((now.getTime() - sentAt) / 86_400_000) : null,
    startDays,
    missingDocs: r.requiredDocsDone < r.requiredDocsTotal,
    late: !r.isFinal && startDays !== null && startDays < 0,
    startSoon: !r.isFinal && startDays !== null && startDays >= 0 && startDays <= 7,
  };
}

export interface AttentionItem {
  key: string;
  count: number;
  text: string;
  tone: "danger" | "warning" | "info";
  href: string;
  /** Até 3 admissões de exemplo (link direto). */
  samples: Array<{ id: string; name: string }>;
  /** Todas as admissões que caem no alerta. */
  ids: string[];
}

/** Situações que pedem ação — só admissões em andamento, só fatos do banco. */
export function attentionItems(rows: ReportAdmission[], now: Date): AttentionItem[] {
  const active = rows.filter((r) => !r.isFinal).map((r) => ({ r, s: admissionSignals(r, now) }));
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const defs: Array<Omit<AttentionItem, "count" | "samples" | "text" | "ids"> & { match: (x: (typeof active)[number]) => boolean; text: (n: number) => string }> = [
    {
      key: "late",
      tone: "danger",
      href: "/admissoes?filtro=atrasadas",
      match: ({ s }) => s.late,
      text: (n) => `${n} ${plural(n, "admissão com data de início vencida", "admissões com data de início vencida")}`,
    },
    {
      key: "soon-incomplete",
      tone: "danger",
      href: "/admissoes?filtro=proximas",
      match: ({ s }) => s.startSoon && s.missingDocs,
      text: (n) => `${n} ${plural(n, "admissão começa", "admissões começam")} em até 7 dias com documentação incompleta`,
    },
    {
      key: "soon-no-exam",
      tone: "warning",
      href: "/admissoes?filtro=proximas",
      match: ({ r, s }) => (s.startSoon || s.late) && !r.examDate,
      text: (n) => `${n} ${plural(n, "admissão", "admissões")} com início próximo sem ASO agendado`,
    },
    {
      key: "docs-review",
      tone: "warning",
      href: "/admissoes",
      match: ({ r }) => r.docsToReview > 0,
      text: (n) => `${n} ${plural(n, "admissão com documentos", "admissões com documentos")} aguardando conferência do RH`,
    },
    {
      key: "form-waiting",
      tone: "warning",
      href: "/admissoes?filtro=formulario",
      match: ({ s }) => s.formWaitingDays !== null && s.formWaitingDays > 3,
      text: (n) => `${n} ${plural(n, "admissão aguardando", "admissões aguardando")} formulário há mais de 3 dias`,
    },
    {
      key: "form-expired",
      tone: "info",
      href: "/admissoes?filtro=formulario",
      match: ({ s }) => s.form === "EXPIRED",
      text: (n) => `${n} ${plural(n, "link de formulário expirou", "links de formulário expiraram")} sem preenchimento`,
    },
  ];
  return defs
    .map((d) => {
      const hits = active.filter(d.match);
      return {
        key: d.key,
        tone: d.tone,
        href: d.href,
        count: hits.length,
        text: d.text(hits.length),
        samples: hits.slice(0, 3).map(({ r }) => ({ id: r.id, name: r.fullName })),
        ids: hits.map(({ r }) => r.id),
      };
    })
    .filter((i) => i.count > 0);
}

export interface ReportSummary {
  cohort: ReportAdmission[];
  active: number;
  activeWithIssues: number;
  completed: number;
  created: number;
  /** Variação % de novas admissões vs. janela anterior — null se não há base confiável. */
  createdDeltaPct: number | null;
  branches: number;
  docsPending: number;
  docsToReview: number;
  docsMissing: number;
  examPending: number;
  examPendingSoon: number;
  dataSince: string | null; // ISO da admissão mais antiga do recorte
}

export function summarizeReport(all: ReportAdmission[], f: ReportFilters, now: Date): ReportSummary {
  const filtered = applyReportFilters(all, f);
  const { from, prevFrom, prevTo } = periodWindow(f.period, now);
  const cohort = filtered.filter((r) => inWindow(r.createdAt, from, null));

  // Comparação só quando o sistema já tinha dados em TODA a janela anterior e há base > 0.
  const earliest = all.reduce<string | null>((m, r) => (!m || r.createdAt < m ? r.createdAt : m), null);
  let createdDeltaPct: number | null = null;
  if (prevFrom && prevTo && earliest && new Date(earliest) <= prevFrom) {
    const prev = filtered.filter((r) => inWindow(r.createdAt, prevFrom, prevTo)).length;
    if (prev > 0) createdDeltaPct = Math.round(((cohort.length - prev) / prev) * 1000) / 10;
  }

  const active = cohort.filter((r) => !r.isFinal);
  const withIssues = new Set(attentionItems(cohort, now).flatMap((i) => i.ids));
  const docsToReview = active.filter((r) => r.docsToReview > 0).length;
  const docsMissing = active.filter((r) => r.requiredDocsDone < r.requiredDocsTotal).length;

  return {
    cohort,
    active: active.length,
    activeWithIssues: withIssues.size,
    completed: cohort.length - active.length,
    created: cohort.length,
    createdDeltaPct,
    branches: new Set(cohort.map((r) => r.branchId).filter(Boolean)).size,
    docsPending: active.filter((r) => r.docsToReview > 0 || r.requiredDocsDone < r.requiredDocsTotal).length,
    docsToReview,
    docsMissing,
    examPending: active.filter((r) => !r.examDate).length,
    examPendingSoon: active.filter((r) => {
      const s = admissionSignals(r, now);
      return !r.examDate && (s.startSoon || s.late);
    }).length,
    dataSince: cohort.reduce<string | null>((m, r) => (!m || r.createdAt < m ? r.createdAt : m), null),
  };
}

/** Meses do gráfico: os do período (máx. 12); "tudo" = do primeiro mês com dado até hoje. */
export function monthlySeries(cohort: ReportAdmission[], f: ReportFilters, now: Date) {
  const { from } = periodWindow(f.period, now);
  const first = from ?? (cohort.length ? new Date(cohort.reduce((m, r) => (r.createdAt < m ? r.createdAt : m), cohort[0].createdAt)) : now);
  let start = new Date(first.getFullYear(), first.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const span = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
  if (span > 12) start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  // Mínimo de 6 colunas quando o recorte é curto, para o gráfico ter contexto.
  if (span < 6 && f.period !== "30d" && f.period !== "90d") start = new Date(end.getFullYear(), end.getMonth() - 5, 1);

  const months: Array<{ key: string; label: string; fullLabel: string; value: number }> = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      fullLabel: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      value: 0,
    });
  }
  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const r of cohort) {
    const d = new Date(r.createdAt);
    const i = idx.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    if (i !== undefined) months[i].value += 1;
  }
  return months;
}

/** Contagem por dimensão, ordenada do maior para o menor. */
export function countBy(
  rows: ReportAdmission[],
  pick: (r: ReportAdmission) => { key: string; label: string; color?: string | null }
) {
  const m = new Map<string, { key: string; label: string; value: number; color?: string | null }>();
  for (const r of rows) {
    const v = pick(r);
    const cur = m.get(v.key) ?? { ...v, value: 0 };
    cur.value += 1;
    m.set(v.key, cur);
  }
  return [...m.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
}
