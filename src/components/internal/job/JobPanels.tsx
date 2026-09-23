"use client";

// Painéis de leitura da página da vaga: resumo operacional, origem (solicitação),
// resumo de divulgação, pipeline do processo e linha do tempo. Só dados reais.

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FilePlus2,
  Megaphone,
  PauseCircle,
  PencilLine,
  RefreshCw,
  RotateCcw,
  UserCheck,
  UserMinus,
  UserPlus,
  XCircle,
  Ban,
  Flag,
} from "lucide-react";
import { Panel, panelLinkClass } from "@/components/ui/Panel";
import { StatusBadge, StageBadge, TONE_TEXT, type Tone } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Dialog } from "@/components/ui/Dialog";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ActivityTimeline, type TimelineEvent } from "@/components/ui/ActivityTimeline";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { JOB_REQUEST_STATUS_LABELS } from "@/lib/job-requests/constants";
import { PIPELINE_GROUP_META, type PipelineGroup } from "@/lib/recruitment/candidate-presentation";
import { remainingLabel, type PositionsSummary } from "@/lib/jobs/positions";
import { deadlineView, formatStoredDate } from "@/lib/jobs/deadlines";
import type { ScopeDivergence } from "@/lib/jobs/approved-scope";
import type { HistoryItem, HistoryKind } from "@/lib/jobs/history";
import type { PublicationStatus } from "@/types/domain";

// ─── Tipos compartilhados com a página (server) ─────────────────────────────────────────

export interface PipelineStageCount {
  id: string;
  name: string;
  color: string;
  kind: string;
  hidden: boolean;
  count: number;
}

export interface PipelineData {
  total: number;
  groups: Record<PipelineGroup, number>;
  stages: PipelineStageCount[];
  /** Candidatos em etapas de entrevista (null quando o funil não tem etapa "Entrevista…"). */
  interviewCount: number | null;
}

export interface OriginRequest {
  id: string;
  code: string | null;
  requesterName: string | null;
  status: string;
}

// ─── Resumo operacional (sidebar) ───────────────────────────────────────────────────────

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-meta text-wg-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-body font-medium text-wg-ink">
        {children}
        {hint && <div className="text-[12px] font-normal">{hint}</div>}
      </dd>
    </div>
  );
}

function DeadlineHint({ iso }: { iso: string | null }) {
  const v = deadlineView(iso);
  if (!v) return null;
  return <span className={TONE_TEXT[v.tone as Tone] ?? "text-wg-ink-muted"}>{v.label}</span>;
}

export function JobSummaryPanel({
  statusLabel,
  statusTone,
  isTalentPool,
  positions,
  pipeline,
  recruiter,
  manager,
  hiringDeadline,
  closingDate,
}: {
  statusLabel: string;
  statusTone: Tone;
  isTalentPool: boolean;
  positions: PositionsSummary;
  pipeline: PipelineData;
  recruiter: string | null;
  manager: string | null;
  hiringDeadline: string | null;
  closingDate: string | null;
}) {
  return (
    <Panel title="Resumo">
      <dl className="-mt-1 divide-y divide-wg-border-lighter">
        <Row label="Status">
          <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
        </Row>
        {!isTalentPool && (
          <>
            <Row label="Posições">{positions.total}</Row>
            <Row label="Preenchidas">{positions.filled}</Row>
            <Row label="Restantes" hint={positions.total > 0 && positions.open === 0 ? <span className="text-success-fg">{remainingLabel(positions)}</span> : null}>
              {positions.open}
            </Row>
          </>
        )}
        <Row label="Candidatos">{pipeline.total}</Row>
        {pipeline.interviewCount !== null ? (
          <Row label="Em entrevistas">{pipeline.interviewCount}</Row>
        ) : (
          <Row label="Em processo">{pipeline.groups.IN_PROCESS}</Row>
        )}
        <Row label="Finalistas">{pipeline.groups.FINALIST}</Row>
        <Row label="Recrutador">{recruiter || <span className="font-normal text-wg-ink-muted">Não definido</span>}</Row>
        <Row label="Gestor">{manager || <span className="font-normal text-wg-ink-muted">Não definido</span>}</Row>
        <Row label="Inscrições até" hint={<DeadlineHint iso={closingDate} />}>
          {closingDate ? formatStoredDate(closingDate) : <span className="font-normal text-wg-ink-muted">Sem data</span>}
        </Row>
        {!isTalentPool && (
          <Row label="Contratação prevista" hint={<DeadlineHint iso={hiringDeadline} />}>
            {hiringDeadline ? formatStoredDate(hiringDeadline) : <span className="font-normal text-wg-ink-muted">Sem prazo</span>}
          </Row>
        )}
      </dl>
    </Panel>
  );
}

// ─── Origem (solicitação) ───────────────────────────────────────────────────────────────

export function JobOriginCard({ origin, divergences }: { origin: OriginRequest | null; divergences: ScopeDivergence[] }) {
  const [open, setOpen] = useState(false);
  if (!origin) {
    return (
      <Panel title="Origem">
        <p className="text-body text-wg-ink-muted">Vaga criada diretamente pelo RH, sem solicitação de gestor vinculada.</p>
      </Panel>
    );
  }
  const approved = origin.status === "APPROVED" || origin.status === "RECRUITING";
  const statusLabel = approved
    ? "Solicitação aprovada"
    : JOB_REQUEST_STATUS_LABELS[origin.status as keyof typeof JOB_REQUEST_STATUS_LABELS] ?? origin.status;
  return (
    <Panel title="Origem">
      <div className="-mt-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-body font-semibold text-wg-ink">{origin.code ?? "Sem número"}</span>
          <StatusBadge tone={approved ? "success" : "warning"} icon={approved ? CheckCircle2 : undefined}>
            {statusLabel}
          </StatusBadge>
        </div>
        <div>
          <p className="text-meta text-wg-ink-muted">Solicitada por</p>
          <p className="text-body font-medium text-wg-ink">{origin.requesterName || "Gestor não informado"}</p>
        </div>
        {divergences.length > 0 && (
          <div className="rounded-control border border-warning-border bg-warning-bg px-3 py-2">
            <p className="text-meta text-warning-fg">Esta vaga possui alterações em relação à solicitação original.</p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-1 text-meta font-semibold text-warning-fg underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
            >
              Ver alterações
            </button>
          </div>
        )}
        <ButtonLink href={`/solicitacoes/${origin.id}`} variant="secondary" size="sm" className="w-full">
          Ver solicitação
        </ButtonLink>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Aprovado na solicitação × vaga atual"
        description={`Comparação com o escopo aprovado na ${origin.code ?? "solicitação"}. A solicitação original não é alterada pela edição da vaga.`}
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body">
            <thead>
              <tr className="border-b border-wg-border-lighter text-meta text-wg-ink-muted">
                <th className="py-2 pr-4 font-medium">Campo</th>
                <th className="py-2 pr-4 font-medium">Aprovado na solicitação</th>
                <th className="py-2 font-medium">Configuração atual</th>
              </tr>
            </thead>
            <tbody>
              {divergences.map((d) => (
                <tr key={d.field} className="border-b border-wg-border-lighter last:border-0">
                  <td className="py-2 pr-4 text-wg-ink-secondary">{d.label}</td>
                  <td className="py-2 pr-4 text-wg-ink">{d.approved}</td>
                  <td className="py-2 font-medium text-warning-fg">{d.current}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialog>
    </Panel>
  );
}

// ─── Resumo de divulgação (Visão geral) ─────────────────────────────────────────────────

export function DistributionSummary({
  isPublic,
  linkedinStatus,
  onManage,
}: {
  isPublic: boolean;
  linkedinStatus: PublicationStatus | null;
  onManage: () => void;
}) {
  const rows: Array<{ label: string; on: boolean; text: string }> = [
    { label: "Portal de carreiras", on: isPublic, text: isPublic ? "Publicada" : "Não publicada" },
    { label: "Google for Jobs", on: isPublic, text: isPublic ? "Ativo" : "Inativo" },
    { label: "Indeed", on: isPublic, text: isPublic ? "Ativo" : "Inativo" },
    {
      label: "LinkedIn",
      on: linkedinStatus === "PUBLISHED",
      text: linkedinStatus === "PUBLISHED" ? "Publicado" : linkedinStatus === "FAILED" ? "Falhou" : "Não publicado",
    },
  ];
  return (
    <Panel
      title="Divulgação"
      action={
        <button type="button" onClick={onManage} className={panelLinkClass}>
          Gerenciar <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      }
    >
      <ul className="-mt-1 divide-y divide-wg-border-lighter">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 py-2">
            <span className="text-body text-wg-ink-secondary">{r.label}</span>
            <span className={cn("inline-flex items-center gap-1.5 text-meta font-medium", r.on ? "text-success-fg" : "text-wg-ink-muted")}>
              {r.on ? <span aria-hidden className="h-2 w-2 rounded-full bg-success" /> : <Circle className="h-2.5 w-2.5" aria-hidden />}
              {r.text}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ─── Aba Processo seletivo ──────────────────────────────────────────────────────────────

export function PipelineOverview({
  jobId,
  pipeline,
  positions,
  isTalentPool,
}: {
  jobId: string;
  pipeline: PipelineData;
  positions: PositionsSummary;
  isTalentPool: boolean;
}) {
  const visible = pipeline.stages.filter((s) => !s.hidden && s.kind !== "LOST");
  const offBoard = pipeline.stages.filter((s) => (s.hidden || s.kind === "LOST") && s.count > 0);
  const max = Math.max(1, ...visible.map((s) => s.count));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Candidaturas" value={pipeline.total} />
        <Metric label={PIPELINE_GROUP_META.IN_PROCESS.label} value={pipeline.groups.IN_PROCESS} hint={PIPELINE_GROUP_META.IN_PROCESS.hint} />
        <Metric label={PIPELINE_GROUP_META.FINALIST.label} value={pipeline.groups.FINALIST} hint={PIPELINE_GROUP_META.FINALIST.hint} />
        {isTalentPool ? (
          <Metric label={PIPELINE_GROUP_META.CLOSED.label} value={pipeline.groups.CLOSED} hint={PIPELINE_GROUP_META.CLOSED.hint} />
        ) : (
          <Metric label="Contratados" value={`${positions.filled}/${positions.total}`} hint="Posições preenchidas / posições ativas" />
        )}
      </div>

      <Panel
        title="Pipeline da vaga"
        description="Etapas do funil configurado para esta vaga, com a quantidade de candidatos em cada uma."
        action={
          <ButtonLink href={`/vagas/${jobId}/candidatos`} size="sm" variant="secondary">
            Abrir pipeline
          </ButtonLink>
        }
      >
        {pipeline.total === 0 ? (
          <EmptyState icon={UserPlus} title="Nenhuma candidatura ainda" description="Quando alguém se inscrever, o funil aparece aqui." />
        ) : (
          <ol className="space-y-2.5">
            {visible.map((s) => (
              <li key={s.id} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3">
                <StageBadge color={s.color} className="max-w-full justify-self-start truncate">
                  {s.name}
                </StageBadge>
                <div className="h-2 overflow-hidden rounded-full bg-[#EDF1E8]" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: s.color }} />
                </div>
                <span className="w-10 text-right font-sora text-body font-semibold tabular-nums text-wg-ink">{s.count}</span>
              </li>
            ))}
          </ol>
        )}
        {offBoard.length > 0 && (
          <p className="mt-4 border-t border-wg-border-lighter pt-3 text-meta text-wg-ink-muted">
            Fora do funil: {offBoard.map((s) => `${s.name} (${s.count})`).join(" · ")}
          </p>
        )}
      </Panel>

      {!isTalentPool && (
        <Panel title="Contratações" description="Cada contratação ocupa uma posição da vaga.">
          <div className="flex flex-wrap items-center justify-between gap-2 text-body">
            <span className="font-semibold text-wg-ink">
              {positions.filled} de {positions.total} {positions.total === 1 ? "posição preenchida" : "posições preenchidas"}
            </span>
            <span className="text-meta text-wg-ink-muted">{remainingLabel(positions)}</span>
          </div>
          <ProgressBar value={positions.percent} label="Posições preenchidas" className="mt-2" tone={positions.state === "ALL_FILLED" ? "success" : "brand"} />
        </Panel>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div title={hint} className="rounded-card border border-wg-border-lighter bg-white px-4 py-3">
      <p className="text-meta capitalize text-wg-ink-muted">{label}</p>
      <p className="mt-0.5 font-sora text-xl font-semibold tabular-nums text-wg-ink">{value}</p>
    </div>
  );
}

// ─── Aba Histórico ──────────────────────────────────────────────────────────────────────

const HISTORY_ICON: Record<HistoryKind, typeof Flag> = {
  created: FilePlus2,
  status: RefreshCw,
  published: Megaphone,
  paused: PauseCircle,
  closed: Flag,
  cancelled: Ban,
  position_added: UserPlus,
  position_cancelled: XCircle,
  position_filled: UserCheck,
  position_released: UserMinus,
  fields: PencilLine,
  migration: ClipboardCheck,
};

export function JobHistoryPanel({ items }: { items: HistoryItem[] }) {
  const events: TimelineEvent[] = items.map((i) => ({
    id: i.id,
    at: i.at,
    icon: HISTORY_ICON[i.kind] ?? RotateCcw,
    tone: i.tone,
    title: (
      <>
        <span className="font-medium">{i.title}</span>
        {i.actor && <span className="text-wg-ink-muted"> · por {i.actor}</span>}
      </>
    ),
    description: i.details.length ? (
      <ul className="space-y-0.5">
        {i.details.map((d, n) => (
          <li key={n}>{d}</li>
        ))}
      </ul>
    ) : undefined,
  }));
  return (
    <Panel title="Histórico" description="Criação, status, posições e alterações relevantes da vaga, do mais recente ao mais antigo.">
      <ActivityTimeline events={events} emptyText="Nenhuma movimentação registrada ainda." />
    </Panel>
  );
}

// ─── Aviso "todas as posições preenchidas" ──────────────────────────────────────────────

export function AllFilledNotice({ onClose, onKeep, busy }: { onClose: () => void; onKeep: () => void; busy: boolean }) {
  return (
    <div className="rounded-card border border-success-border bg-success-bg px-4 py-3">
      <p className="flex items-center gap-2 text-body font-semibold text-success-fg">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Todas as posições desta vaga foram preenchidas.
      </p>
      <p className="mt-0.5 text-meta text-success-fg/90">Deseja encerrar a publicação e impedir novas candidaturas?</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onKeep} disabled={busy}>
          Manter publicada
        </Button>
        <Button size="sm" variant="primary" onClick={onClose} loading={busy}>
          Encerrar vaga
        </Button>
      </div>
    </div>
  );
}
