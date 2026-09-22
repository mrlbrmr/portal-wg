"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, CircleDashed, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InfoHint } from "@/components/ui/InfoHint";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge, TONE_TEXT } from "@/components/ui/StatusBadge";
import { cn, formatDate } from "@/lib/utils";
import {
  AI_CRITERION_META,
  AI_FIT_BAND_META,
  MATCH_BASIS_HINT,
  type AiAnalysis,
  type AiCriterionStatus,
} from "@/lib/recruitment/ai-analysis";
import { Section } from "./Section";

interface Props {
  analysis: AiAnalysis | null;
  loading: boolean;
  /** Requisitos obrigatórios da vaga — referência quando a análise não os avaliou. */
  jobCriteria: string[];
  canManage: boolean;
  resumeName: string | null;
  analyzing: boolean;
  onAnalyze: () => void;
}

const CRITERION_ICON: Record<AiCriterionStatus, typeof Check> = {
  MEETS: Check,
  PARTIAL: TriangleAlert,
  NOT_FOUND: CircleDashed,
};

const COLLAPSED_ITEMS = 2;

/**
 * "Análise de currículo" estruturada: score, faixa descritiva, resumo, critérios da vaga
 * um a um, pontos fortes e lacunas. Começa resumida; "Ver análise completa" expande
 * evidências e listas inteiras. A IA é apoio: o texto nunca decide pelo recrutador.
 */
export function AiAnalysisPanel({ analysis, loading, jobCriteria, canManage, resumeName, analyzing, onAnalyze }: Props) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [analysis?.id]);

  const isPdf = !!resumeName?.toLowerCase().endsWith(".pdf");
  const analyzeButton = canManage && isPdf && (
    <Button size="sm" variant="tertiary" icon={analysis ? RefreshCw : Sparkles} loading={analyzing} onClick={onAnalyze}>
      {analyzing ? "Analisando…" : analysis ? "Reanalisar" : "Analisar com IA"}
    </Button>
  );

  if (loading && !analysis) {
    return (
      <Section title="Análise de currículo">
        <div className="space-y-2" aria-busy="true" aria-label="Carregando análise">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </Section>
    );
  }

  if (!analysis) {
    return (
      <Section title="Análise de currículo" action={analyzeButton}>
        <p className="text-body text-wg-ink-muted">
          {!resumeName
            ? "Sem currículo anexado — não há o que analisar."
            : !isPdf
            ? "A análise por IA só lê currículos em PDF. Substitua o arquivo para analisar."
            : "Este currículo ainda não foi analisado."}
        </p>
        {jobCriteria.length > 0 && <JobCriteriaReference criteria={jobCriteria} />}
      </Section>
    );
  }

  const band = analysis.band ? AI_FIT_BAND_META[analysis.band] : null;
  const strengths = expanded ? analysis.strengths : analysis.strengths.slice(0, COLLAPSED_ITEMS);
  const gaps = expanded ? analysis.gaps : analysis.gaps.slice(0, COLLAPSED_ITEMS);
  const hidden =
    Math.max(0, analysis.strengths.length - COLLAPSED_ITEMS) +
    Math.max(0, analysis.gaps.length - COLLAPSED_ITEMS) +
    (analysis.criteria.some((c) => c.evidence) ? 1 : 0) +
    ((analysis.reason?.length ?? 0) > 220 ? 1 : 0);

  return (
    <Section
      title="Análise de currículo"
      meta={
        <span className="text-[12px] font-normal text-wg-ink-muted">
          {formatDate(analysis.analyzedAt)}
          {analysis.engine && ` · IA: ${analysis.engine}`}
        </span>
      }
      action={analyzeButton}
    >
      {/* Score */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {analysis.score !== null && (
          <p className="font-sora text-[26px] font-semibold leading-none tabular-nums text-wg-ink">
            {analysis.score}
            <span className="text-[15px] font-medium text-wg-ink-muted"> / 100</span>
          </p>
        )}
        {band && (
          <StatusBadge tone={band.tone} hint={band.hint}>
            {band.label}
          </StatusBadge>
        )}
        <InfoHint text={MATCH_BASIS_HINT} label="Como a análise é feita" />
      </div>

      {/* Resumo */}
      {analysis.reason && (
        <div className="mt-3">
          <h4 className="text-[12px] font-medium text-wg-ink-muted">Resumo da análise</h4>
          <p className={cn("mt-0.5 text-body text-wg-ink-secondary", !expanded && "line-clamp-3")}>{analysis.reason}</p>
        </div>
      )}

      {/* Critérios */}
      <div className="mt-4">
        <h4 className="mb-1 text-[12px] font-medium text-wg-ink-muted">Critérios avaliados</h4>
        {analysis.criteria.length > 0 ? (
          <ul className="divide-y divide-wg-border-lighter/70">
            {analysis.criteria.map((c) => {
              const meta = AI_CRITERION_META[c.status];
              const Icon = CRITERION_ICON[c.status];
              return (
                <li key={c.criterion} className="py-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-body text-wg-ink">{c.criterion}</span>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 text-meta font-medium", TONE_TEXT[meta.tone])}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {meta.label}
                    </span>
                  </div>
                  {expanded && c.evidence && <p className="mt-0.5 text-[12px] text-wg-ink-muted">{c.evidence}</p>}
                </li>
              );
            })}
          </ul>
        ) : jobCriteria.length > 0 ? (
          <JobCriteriaReference criteria={jobCriteria} note="Esta análise é anterior à avaliação por critério. Reanalise para ver cada requisito." />
        ) : (
          <p className="text-meta text-wg-ink-muted">A vaga não tem requisitos obrigatórios em lista.</p>
        )}
      </div>

      {/* Pontos fortes × lacunas */}
      {(strengths.length > 0 || gaps.length > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <BulletList title="Pontos fortes" items={strengths} kind="strength" />
          <BulletList title="Lacunas" items={gaps} kind="gap" />
        </div>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 inline-flex items-center gap-1 text-meta font-medium text-wg-green-dark underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
        >
          {expanded ? "Mostrar resumo" : "Ver análise completa"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      )}

      <p className="mt-3 text-[11.5px] text-wg-ink-muted">
        Leitura automática do currículo frente aos requisitos da vaga. “Não identificado” significa que o currículo não
        menciona — confira o arquivo antes de decidir.
      </p>
    </Section>
  );
}

function BulletList({ title, items, kind }: { title: string; items: string[]; kind: "strength" | "gap" }) {
  const Icon = kind === "strength" ? Check : TriangleAlert;
  return (
    <div className="min-w-0">
      <h4 className="mb-1 text-[12px] font-medium text-wg-ink-muted">{title}</h4>
      {items.length === 0 ? (
        <p className="text-meta text-wg-ink-muted">Nenhum registrado.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it} className="flex items-start gap-1.5 text-meta text-wg-ink-secondary">
              <Icon
                className={cn("mt-[3px] h-3.5 w-3.5 shrink-0", kind === "strength" ? "text-success" : "text-warning")}
                aria-label={kind === "strength" ? "Ponto forte" : "Lacuna"}
              />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JobCriteriaReference({ criteria, note }: { criteria: string[]; note?: string }) {
  return (
    <div className="mt-2">
      <ul className="divide-y divide-wg-border-lighter/70">
        {criteria.map((c) => (
          <li key={c} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0 text-body text-wg-ink">{c}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-meta text-wg-ink-muted">
              <CircleDashed className="h-3.5 w-3.5" aria-hidden />
              Não avaliado
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11.5px] text-wg-ink-muted">
        {note ?? "Requisitos obrigatórios da vaga — use como roteiro da triagem."}
      </p>
    </div>
  );
}
