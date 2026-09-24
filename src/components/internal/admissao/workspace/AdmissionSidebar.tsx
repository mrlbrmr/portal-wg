"use client";

import { useMemo, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StageBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { admissionProgress, daysFromToday, formatDateBR, relativeDaysLabel, todayFrom, type Pendency } from "@/lib/admissao/workspace";
import { useAdmissionWorkspace } from "./context";
import { AdmissionFormStatus } from "./AdmissionFormStatus";

// Sidebar operacional: a situação da admissão sem rolar a página. Mostra sempre o que
// está GRAVADO (não o rascunho em edição) — é o retrato oficial da admissão.

function Section({ title, children, first }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <section className={cn("px-5 py-4", !first && "border-t border-wg-border-lighter")}>
      <h2 className="mb-2.5 text-label uppercase tracking-wide text-wg-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children, hint, hintTone }: { label: string; children: ReactNode; hint?: string | null; hintTone?: "danger" | "muted" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-meta text-wg-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className="block truncate text-body font-medium text-wg-ink">{children}</span>
        {hint && <span className={cn("block text-[12px]", hintTone === "danger" ? "text-danger-fg" : "text-wg-ink-muted")}>{hint}</span>}
      </dd>
    </div>
  );
}

const PENDENCY_ICON: Record<Pendency["tone"], { icon: typeof Info; className: string }> = {
  danger: { icon: AlertTriangle, className: "text-danger" },
  warning: { icon: AlertTriangle, className: "text-warning" },
  info: { icon: Info, className: "text-info" },
};

export function AdmissionSidebar() {
  const { data, options, setTab } = useAdmissionWorkspace();
  const { record: r, saved: s } = data;
  const open = !s.stageIsFinal;
  const progress = useMemo(() => admissionProgress(options.stages, r.stageId), [options.stages, r.stageId]);

  const today = todayFrom(data.today);
  const startDays = r.startDate ? daysFromToday(r.startDate, today) : null;
  const examDays = r.medicalExamDate ? daysFromToday(r.medicalExamDate, today) : null;

  return (
    <div className="overflow-hidden rounded-card border border-wg-border-lighter bg-white">
      <Section title="Status da admissão" first>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {s.stageName ? (
            <StageBadge color={s.stageColor ?? undefined} hint="Etapa atual">
              {s.stageName}
            </StageBadge>
          ) : (
            <StageBadge>Sem etapa</StageBadge>
          )}
          {s.stageIsFinal && <StatusBadge tone="success">Concluída</StatusBadge>}
        </div>
        <dl>
          <Row
            label="Data de início"
            hint={open && startDays !== null ? relativeDaysLabel(startDays) : null}
            hintTone={open && startDays !== null && startDays < 0 ? "danger" : "muted"}
          >
            {formatDateBR(r.startDate) ?? <span className="font-normal text-wg-ink-muted">A definir</span>}
          </Row>
          <Row label="ASO" hint={open && examDays !== null ? relativeDaysLabel(examDays) : null}>
            {formatDateBR(r.medicalExamDate) ?? <span className="font-normal text-wg-ink-muted">Não agendado</span>}
          </Row>
          <Row label="Responsável">{s.responsibleName ?? <span className="font-normal text-wg-ink-muted">Sem responsável</span>}</Row>
        </dl>
      </Section>

      <Section title="Formulário de admissão">
        <AdmissionFormStatus />
      </Section>

      <Section title={data.pendencies.length ? `Pendências (${data.pendencies.length})` : "Pendências"}>
        {data.pendencies.length === 0 ? (
          <p className="flex items-center gap-2 text-body text-success-fg">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            {s.stageIsFinal ? "Admissão concluída." : "Nenhuma pendência."}
          </p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {data.pendencies.map((p) => {
              const { icon: Icon, className } = PENDENCY_ICON[p.tone];
              const content = (
                <>
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} aria-hidden />
                  <span className="min-w-0 flex-1 text-left">{p.text}</span>
                  {p.tab && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-wg-ink-muted" aria-hidden />}
                </>
              );
              return (
                <li key={p.key}>
                  {p.tab ? (
                    <button
                      type="button"
                      onClick={() => setTab(p.tab!)}
                      className="flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-meta text-wg-ink transition-colors hover:bg-wg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex items-start gap-2 px-2 py-1.5 text-meta text-wg-ink">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Progresso">
        {progress.total > 0 ? (
          <>
            <p className="mb-1.5 flex items-baseline justify-between text-meta">
              <span className="text-wg-ink-secondary">
                {progress.isComplete ? "Todas as etapas concluídas" : `${progress.completed} de ${progress.total} etapas`}
              </span>
              <span className="font-semibold tabular-nums text-wg-ink">{progress.percent}%</span>
            </p>
            <ProgressBar value={progress.percent} label="Progresso da admissão" tone={progress.isComplete ? "success" : "brand"} />
          </>
        ) : (
          <p className="text-meta text-wg-ink-muted">Nenhuma etapa configurada.</p>
        )}
        {data.docs.requiredTotal > 0 && (
          <button
            type="button"
            onClick={() => setTab("documentos")}
            className="mt-3 flex w-full items-baseline justify-between gap-2 rounded-control text-meta text-wg-ink-secondary hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
          >
            <span>Documentos obrigatórios</span>
            <span className="font-semibold tabular-nums text-wg-ink">
              {data.docs.requiredDone} de {data.docs.requiredTotal}
            </span>
          </button>
        )}
      </Section>
    </div>
  );
}
