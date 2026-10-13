import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  CONTRACT_TYPE_LABELS,
  MODALITY_LABELS,
  formatDate,
  formatRelativeTime,
  pluralDays,
  daysSince,
  cn,
} from "@/lib/utils";
import { JOB_LIFECYCLE_META, jobLifecycle } from "@/lib/recruitment/job-presentation";
import { publicationIndicator } from "@/lib/jobs/publication";
import { operationalSituation, SITUATION_META, type AttentionReason } from "@/lib/recruitment/attention";
import { JOB_REQUEST_REASON_LABELS } from "@/lib/job-requests/constants";
import { JobActionsMenu } from "@/components/internal/JobActionsMenu";
import { StatusBadge, TONE_DOT, TONE_TEXT } from "@/components/ui/StatusBadge";
import type { JobRow } from "@/types/jobs";

// Card da lista de Vagas. Hierarquia (ênfase por exceção):
//   1º título, motivos de atenção, candidatos, preenchimento e status fora do comum;
//   2º onde/como (cidade, área, modalidade);
//   3º contexto administrativo (responsável, idade, movimentação) e, num grupo à parte,
//      motivo da abertura e contrato (só quando não é CLT).
// O âmbar/vermelho fica reservado aos motivos de atenção — métricas comuns não pintam.

export type JobListRow = JobRow & { reasons: AttentionReason[] };

/** Idade da vaga conforme o status: "Aberta há X" só faz sentido para vagas abertas. */
function ageLabel(job: JobRow): string {
  const l = jobLifecycle(job.status);
  if (l === "OPEN") return `Aberta há ${pluralDays(daysSince(job.openedAt))}`;
  if (l === "DRAFT") return `Criada há ${pluralDays(daysSince(job.createdAt))}`;
  if (l === "PAUSED") return `Pausada em ${formatDate(job.statusChangedAt)}`;
  return `${JOB_LIFECYCLE_META[l].label} em ${formatDate(job.statusChangedAt)}`;
}

/**
 * Itens de texto separados por "·"; cada item não quebra por dentro, a linha quebra entre eles.
 * Todo item leva o separador À ESQUERDA e a linha é deslocada (-ml-5) dentro de um overflow
 * oculto: o "·" do primeiro item de cada linha fica fora da área visível, inclusive após quebra.
 * `trailing` é um segundo grupo, de menor prioridade, separado por respiro em vez de "·" (a
 * margem fica no fim da linha anterior quando o grupo quebra, então não sobra recuo).
 * Itens longos (nome, área, cidade) terminam em reticências em vez de estourar o card.
 */
function MetaLine({ items, trailing = [], className }: { items: ReactNode[]; trailing?: ReactNode[]; className?: string }) {
  const lead = items.filter(Boolean);
  const tail = trailing.filter(Boolean);
  if (lead.length === 0 && tail.length === 0) return null;
  const sep = (
    <span aria-hidden className="w-5 shrink-0 text-center text-wg-ink-muted/50">
      ·
    </span>
  );
  return (
    <div className={cn("overflow-hidden", className)}>
      <p className="-ml-5 flex flex-wrap items-center">
        {lead.map((item, i) => (
          <span
            key={i}
            className={cn(
              "inline-flex min-w-0 max-w-full items-center whitespace-nowrap",
              i === lead.length - 1 && tail.length > 0 && "mr-4"
            )}
          >
            {sep}
            <span className="truncate">{item}</span>
          </span>
        ))}
        {tail.length > 0 && (
          <span className="inline-flex min-w-0 max-w-full items-center whitespace-nowrap">
            <span aria-hidden className="w-5 shrink-0" />
            <span className="truncate">
              {tail.map((t, i) => (
                <span key={i}>
                  {i > 0 && (
                    <span aria-hidden className="px-1.5 text-wg-ink-muted/50">
                      ·
                    </span>
                  )}
                  {t}
                </span>
              ))}
            </span>
          </span>
        )}
      </p>
    </div>
  );
}

/** Tooltip do estado (inclui o canal de publicação quando a vaga está aberta). */
function statusHint(job: JobRow): string {
  const lifecycle = jobLifecycle(job.status);
  const pub = publicationIndicator({ status: job.status, visibility: job.visibility ?? "BOTH" });
  if (lifecycle === "OPEN" && pub) return pub.label === "Publicada" ? `Aberta e publicada — ${pub.hint}` : pub.hint;
  return JOB_LIFECYCLE_META[lifecycle].hint;
}

/**
 * Ênfase por exceção. Aberta + publicada é o estado padrão de quase toda a lista: não ganha selo
 * — o texto "Aberta há X dias" da linha terciária já diz o estado (e o leitor de tela ouve o
 * status completo). Não publicada, Rascunho, Pausada, Encerrada e Cancelada ganham a pílula.
 */
function JobStatus({ job }: { job: JobRow }) {
  const lifecycle = jobLifecycle(job.status);
  const pub = publicationIndicator({ status: job.status, visibility: job.visibility ?? "BOTH" });
  if (lifecycle === "OPEN" && pub?.label === "Publicada") {
    return <span className="sr-only">Status: aberta e publicada ({pub.hint}).</span>;
  }
  if (lifecycle === "OPEN" && pub) {
    return (
      <StatusBadge tone="info" hint={pub.hint}>
        {pub.label}
      </StatusBadge>
    );
  }
  const meta = JOB_LIFECYCLE_META[lifecycle];
  return (
    <StatusBadge tone={meta.tone} hint={meta.hint}>
      {meta.label}
    </StatusBadge>
  );
}

/** Posições preenchidas — "0/1 preenchida", em verde quando todas foram preenchidas. */
function PositionsFill({ filled, total }: { filled: number; total: number }) {
  const done = filled === total;
  return (
    <span
      title="Posições preenchidas / posições da vaga"
      className={cn("font-medium", done ? "text-success-fg" : "text-wg-ink")}
    >
      <span aria-hidden>
        {filled}/{total} {total === 1 ? "preenchida" : "preenchidas"}
      </span>
      <span className="sr-only">
        {filled} de {total} {total === 1 ? "posição preenchida" : "posições preenchidas"}
      </span>
    </span>
  );
}

/** Bloco de candidatos = link para o pipeline da vaga (substitui o antigo botão "Ver candidatos"). */
function CandidateSummary({ job }: { job: JobRow }) {
  const total = job.candidateCount;
  const novos = job.newCount;
  const label =
    `Ver ${total} ${total === 1 ? "candidato" : "candidatos"} de ${job.title}` +
    (novos > 0 ? `, ${novos} ${novos === 1 ? "novo" : "novos"}` : "");

  return (
    <Link
      href={`/vagas/${job.id}/candidatos`}
      aria-label={label}
      className={cn(
        "group/cand flex min-h-[48px] flex-1 items-center gap-2 rounded-control border border-transparent px-2.5 py-1.5 sm:flex-none sm:min-w-[148px] sm:justify-end",
        // Hover mais evidente que o do card: é a ação principal da linha.
        "transition-colors duration-150 hover:border-wg-border-light hover:bg-wg-sidebar focus-visible:bg-wg-sidebar active:bg-wg-hover-light"
      )}
    >
      <span className="min-w-0 sm:text-right">
        <span className="flex items-baseline gap-1.5 whitespace-nowrap sm:justify-end">
          <span
            className={cn(
              "font-sora text-lg font-semibold leading-6 tabular-nums",
              total === 0 ? "text-wg-ink-muted" : "text-wg-ink"
            )}
          >
            {total}
          </span>
          <span className="text-meta text-wg-ink-secondary">{total === 1 ? "candidato" : "candidatos"}</span>
        </span>
        {/* "Novo" = novidade (verde da marca), não alerta: o âmbar fica com "aguardando triagem". */}
        {novos > 0 && (
          <span className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold leading-4 text-wg-green-dark sm:justify-end">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-wg-green" />
            {novos} {novos === 1 ? "novo" : "novos"}
          </span>
        )}
      </span>
      <ChevronRight
        aria-hidden
        className="ml-auto h-4 w-4 shrink-0 text-wg-ink-muted/70 transition-[color,transform] duration-150 group-hover/cand:translate-x-0.5 group-hover/cand:text-wg-ink sm:ml-0"
      />
    </Link>
  );
}

export function JobListItem({ job, canManage }: { job: JobListRow; canManage: boolean }) {
  const situation = operationalSituation(job.reasons);

  const location = job.isTalentPool ? "Todas as praças" : [job.city, job.state].filter(Boolean).join("/");
  const hasPositions = job.positionsTotal != null && job.positionsTotal > 0;

  return (
    <li
      className={cn(
        "group relative flex rounded-card border border-wg-border-lighter bg-white",
        // Hover do card bem sutil — o destaque de hover é do bloco de candidatos (clicável).
        "transition-[box-shadow,border-color] duration-150 hover:border-wg-border-light hover:shadow-[0_2px_8px_rgba(26,34,19,.04)]",
        "focus-within:border-wg-border-light"
      )}
    >
      {/* Faixa = situação operacional (Normal / Atenção / Atrasada). O texto dos motivos abaixo
          explica a cor — ela nunca comunica sozinha. */}
      <span
        aria-hidden
        className={cn(
          "w-1 shrink-0 rounded-l-card",
          situation === "NORMAL" ? "bg-transparent" : TONE_DOT[SITUATION_META[situation].tone]
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-3 pl-4 pr-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link
              href={`/vagas/${job.id}/candidatos`}
              className="min-w-0 break-words rounded-sm text-record-title text-wg-ink transition-colors duration-150 hover:text-wg-green-dark"
            >
              {job.title}
            </Link>
            <JobStatus job={job} />
          </div>

          {/* Secundário: onde/como + preenchimento. */}
          <MetaLine
            className="mt-0.5 text-meta text-wg-ink-secondary"
            items={[
              location ? <span title={location}>{location}</span> : null,
              job.department ? <span title={job.department}>{job.department}</span> : null,
              MODALITY_LABELS[job.modality] ?? null,
              hasPositions ? (
                <PositionsFill filled={job.positionsFilled ?? 0} total={job.positionsTotal!} />
              ) : null,
            ]}
          />

          {/* Terciário: contexto administrativo, menor e mais apagado. Motivo e contrato vêm num
              grupo à parte (só respiro, sem "·"); CLT é o padrão e só aparece o que foge dele. */}
          <MetaLine
            className="mt-0.5 text-[12px] leading-[18px] text-wg-ink-muted"
            items={[
              job.responsible ? (
                <span title={job.responsible}>{job.responsible}</span>
              ) : (
                <span className="pr-0.5 italic">Sem responsável</span>
              ),
              <span title={statusHint(job)} suppressHydrationWarning>
                {ageLabel(job)}
              </span>,
              <span title={`Última movimentação: ${formatDate(job.lastActivityAt)}`} suppressHydrationWarning>
                Atualizada {formatRelativeTime(job.lastActivityAt)}
              </span>,
            ]}
            trailing={[
              job.openingReason ? JOB_REQUEST_REASON_LABELS[job.openingReason] : null,
              job.contractType !== "CLT" ? (CONTRACT_TYPE_LABELS[job.contractType] ?? null) : null,
            ]}
          />

          {job.reasons.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5" aria-label="Motivos de atenção">
              {job.reasons.map((r) => (
                <li key={r.key} className={cn("inline-flex items-center gap-1.5 text-meta font-semibold", TONE_TEXT[r.tone])}>
                  <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[r.tone])} />
                  {r.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="-mx-2.5 flex shrink-0 items-center gap-1 sm:mx-0">
          <CandidateSummary job={job} />
          {canManage && <JobActionsMenu jobId={job.id} jobTitle={job.title} status={job.status} />}
        </div>
      </div>
    </li>
  );
}
