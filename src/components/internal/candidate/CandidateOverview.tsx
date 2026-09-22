"use client";

import { ArrowRight, Check, ExternalLink, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InfoHint } from "@/components/ui/InfoHint";
import { Skeleton } from "@/components/ui/Skeleton";
import { StageBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { AI_FIT_BAND_META, MATCH_BASIS_HINT, type AiAnalysis } from "@/lib/recruitment/ai-analysis";
import { formatExperience } from "@/lib/recruitment/candidate-presentation";
import { CandidateEditForm, type CandidateProfilePatch } from "./CandidateEditForm";
import { ApplicationDetails, CandidateContact } from "./CandidateSummary";
import { ResumeCard } from "./ResumeCard";
import { Missing, Section } from "./Section";
import { formatCurrencyBRL, type CandidateDetail, type LinkedAdmission } from "./types";

interface Props {
  data: CandidateDetail;
  /** Análise de IA mais recente (null = não há). */
  analysis: AiAnalysis | null;
  analysisLoading: boolean;
  canManage: boolean;
  analyzing: boolean;
  onAnalyze: () => void;
  onOpenEvaluations: () => void;
  /** Painel largo: decisão à esquerda, dados de referência à direita. */
  wide: boolean;
  uploadingResume: boolean;
  onReplaceResume: (file: File) => void;
  editing: boolean;
  savingProfile: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveProfile: (patch: CandidateProfilePatch) => void;
  onInvalid: (message: string) => void;
  admission: LinkedAdmission | null;
  onCopy: (label: "E-mail" | "Telefone", value: string) => void;
}

/**
 * Visão geral orientada à decisão: primeiro a aderência e o que sustenta a leitura
 * (resumo, fatos-chave, competências, pontos fortes/atenção); depois currículo, contato
 * e dados administrativos. Tudo vem da candidatura e da análise existente — o que não
 * existe aparece como "Não informado" ou simplesmente não aparece.
 */
export function CandidateOverview(props: Props) {
  const { data, analysis, wide } = props;

  const decision = (
    <div className="space-y-5">
      <MatchSummary {...props} />
      <KeyFacts data={data} analysis={analysis} />
      <Skills data={data} analysis={analysis} />
      {analysis && <Highlights analysis={analysis} onOpenEvaluations={props.onOpenEvaluations} />}
    </div>
  );

  const reference = (
    <div>
      <ResumeCard
        applicationId={data.id}
        resumeName={data.resumeName}
        canManage={props.canManage}
        uploading={props.uploadingResume}
        onReplace={props.onReplaceResume}
      />
      {props.editing ? (
        <CandidateEditForm
          data={data}
          saving={props.savingProfile}
          onCancel={props.onCancelEdit}
          onSave={props.onSaveProfile}
          onInvalid={props.onInvalid}
        />
      ) : (
        <>
          <CandidateContact data={data} onCopy={props.onCopy} />
          <ApplicationDetails data={data} canManage={props.canManage} onEdit={props.onEdit} />
        </>
      )}
      {props.admission && <AdmissionSection admission={props.admission} />}
    </div>
  );

  if (wide) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(300px,380px)] gap-8">
        {decision}
        <div className="border-l border-wg-border-lighter pl-8">{reference}</div>
      </div>
    );
  }
  return (
    <div>
      {decision}
      <div className="mt-5 border-t border-wg-border-lighter pt-4">{reference}</div>
    </div>
  );
}

// ── Aderência ────────────────────────────────────────────────────────────────

function MatchSummary({ data, analysis, analysisLoading, canManage, analyzing, onAnalyze, onOpenEvaluations }: Props) {
  if (analysisLoading && !analysis) {
    return (
      <div className="rounded-card bg-wg-bg/70 px-4 py-3.5" aria-busy="true" aria-label="Carregando aderência">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-7 w-16" />
        <Skeleton className="mt-3 h-4 w-full" />
      </div>
    );
  }

  const label = (
    <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-wg-ink-muted">
      Aderência ao perfil
      <InfoHint text={MATCH_BASIS_HINT} label="Como a aderência é calculada" align="left" />
    </p>
  );

  if (!analysis || analysis.score === null) {
    const isPdf = data.resumeName?.toLowerCase().endsWith(".pdf");
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-wg-bg/70 px-4 py-3.5">
        <div>
          {label}
          <p className="mt-1 text-body text-wg-ink-muted">
            {!data.resumeName
              ? "Sem currículo anexado — a aderência não pode ser calculada."
              : !isPdf
              ? "A análise automática só lê currículos em PDF."
              : "Aderência ainda não calculada para este currículo."}
          </p>
        </div>
        {canManage && isPdf && (
          <Button size="sm" variant="secondary" icon={Sparkles} loading={analyzing} onClick={onAnalyze}>
            {analyzing ? "Analisando…" : "Analisar currículo"}
          </Button>
        )}
      </div>
    );
  }

  const band = analysis.band ? AI_FIT_BAND_META[analysis.band] : null;
  const pct = Math.max(0, Math.min(100, analysis.score));

  return (
    <section aria-label="Aderência ao perfil" className="rounded-card bg-wg-bg/70 px-4 py-3.5">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
        <div className="shrink-0">
          {label}
          <p className="mt-1 font-sora text-[28px] font-semibold leading-none tabular-nums text-wg-ink">{pct}%</p>
        </div>
        <div className="min-w-[180px] flex-1 pt-1">
          {band && (
            <StatusBadge tone={band.tone} hint={band.hint}>
              {band.label}
            </StatusBadge>
          )}
          <div
            role="meter"
            aria-label="Aderência ao perfil"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E3EADA]"
          >
            <div className="h-full rounded-full bg-wg-green-dark/70" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-wg-ink-muted">
            <span>Análise de {formatDate(analysis.analyzedAt)}</span>
            {analysis.engine && <span>· IA: {analysis.engine}</span>}
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={onOpenEvaluations}
              className="font-medium text-wg-green-dark underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
            >
              Ver fundamentos
            </button>
          </p>
        </div>
      </div>
      {analysis.profileSummary && (
        <p className="mt-3 border-t border-wg-border-lighter pt-3 text-body text-wg-ink-secondary">{analysis.profileSummary}</p>
      )}
    </section>
  );
}

// ── Fatos-chave ──────────────────────────────────────────────────────────────

function KeyFacts({ data, analysis }: { data: CandidateDetail; analysis: AiAnalysis | null }) {
  const cv = data.cv_profile;
  const years = typeof cv?.experienceYears === "number" ? cv.experienceYears : analysis?.profile.experienceYears ?? null;
  const experience = formatExperience(years)?.replace(" de exp.", "") ?? null;
  const lastPosition = cv?.lastPosition?.trim() || analysis?.profile.lastPosition || null;
  const education = cv?.education?.trim() || analysis?.profile.education || null;

  const facts: Array<{ label: string; value: string | null; sub?: string | null }> = [
    { label: "Experiência", value: experience, sub: lastPosition ? `Último cargo: ${lastPosition}` : null },
    { label: "Formação", value: education },
    { label: "Pretensão salarial", value: data.salaryExpectation !== null ? formatCurrencyBRL(data.salaryExpectation) : null },
    {
      label: "Disponibilidade",
      value: data.availablePresential === null ? null : data.availablePresential ? "Aceita presencial" : "Não aceita presencial",
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {facts.map((f) => (
        <div key={f.label} className="min-w-0 rounded-control bg-wg-bg/60 px-3 py-2">
          <dt className="text-[11.5px] text-wg-ink-muted">{f.label}</dt>
          <dd className="mt-0.5 min-w-0">
            <span className="block truncate text-body font-medium text-wg-ink" title={f.value ?? undefined}>
              {f.value ?? <Missing />}
            </span>
            {f.sub && (
              <span className="block truncate text-[11.5px] text-wg-ink-muted" title={f.sub}>
                {f.sub}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ── Competências ─────────────────────────────────────────────────────────────

function Skills({ data, analysis }: { data: CandidateDetail; analysis: AiAnalysis | null }) {
  const fromCv = (data.cv_profile?.skills ?? []).filter((s) => typeof s === "string" && s.trim());
  const skills = [...new Set((fromCv.length > 0 ? fromCv : analysis?.profile.skills ?? []).map((s) => s.trim()))];
  if (skills.length === 0) return null;
  return (
    <section aria-labelledby="qv-skills">
      <h3 id="qv-skills" className="mb-2 text-[13px] font-semibold text-wg-ink">
        Competências identificadas
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <li key={s} className="rounded-full border border-wg-border-light bg-white px-2.5 py-0.5 text-[12px] text-wg-ink-secondary">
            {s}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11.5px] text-wg-ink-muted">Extraídas do currículo automaticamente — confira no arquivo.</p>
    </section>
  );
}

// ── Pontos fortes × atenção ──────────────────────────────────────────────────

const MAX_HIGHLIGHTS = 4;

function Highlights({ analysis, onOpenEvaluations }: { analysis: AiAnalysis; onOpenEvaluations: () => void }) {
  // Com critérios avaliados, os rótulos curtos dos requisitos são mais escaneáveis que
  // as frases longas; sem eles (análises antigas), usa pontos fortes/lacunas do texto.
  const useCriteria = analysis.criteria.length > 0;
  const strengths = useCriteria
    ? analysis.criteria.filter((c) => c.status === "MEETS").map((c) => c.criterion)
    : analysis.strengths;
  const attention = useCriteria
    ? analysis.criteria
        .filter((c) => c.status !== "MEETS")
        .map((c) => (c.status === "PARTIAL" ? `${c.criterion}: atende em parte` : `${c.criterion}: não identificado no currículo`))
    : analysis.gaps;
  if (strengths.length === 0 && attention.length === 0) return null;

  const more = Math.max(0, strengths.length - MAX_HIGHLIGHTS) + Math.max(0, attention.length - MAX_HIGHLIGHTS);

  return (
    <section aria-label="Pontos fortes e pontos de atenção">
      <div className="grid gap-4 sm:grid-cols-2">
        <HighlightList title="Pontos fortes" items={strengths} kind="strength" />
        <HighlightList title="Pontos de atenção" items={attention} kind="attention" />
      </div>
      <button
        type="button"
        onClick={onOpenEvaluations}
        className="mt-2 inline-flex items-center gap-1 text-meta font-medium text-wg-green-dark underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
      >
        {more > 0 ? `Ver análise completa (+${more})` : "Ver análise completa"}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </section>
  );
}

function HighlightList({ title, items, kind }: { title: string; items: string[]; kind: "strength" | "attention" }) {
  const Icon = kind === "strength" ? Check : TriangleAlert;
  return (
    <div className="min-w-0">
      <h3 className="mb-1.5 text-[13px] font-semibold text-wg-ink">{title}</h3>
      {items.length === 0 ? (
        <p className="text-meta text-wg-ink-muted">{kind === "strength" ? "Nenhum identificado." : "Nenhum ponto de atenção."}</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, MAX_HIGHLIGHTS).map((it) => (
            <li key={it} className="flex items-start gap-1.5 text-meta text-wg-ink-secondary">
              <Icon
                className={kind === "strength" ? "mt-[3px] h-3.5 w-3.5 shrink-0 text-success" : "mt-[3px] h-3.5 w-3.5 shrink-0 text-warning"}
                aria-label={kind === "strength" ? "Ponto forte" : "Atenção"}
              />
              <span className="line-clamp-2" title={it}>
                {it}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Admissão vinculada ───────────────────────────────────────────────────────

function AdmissionSection({ admission }: { admission: LinkedAdmission }) {
  return (
    <Section
      title="Admissão"
      action={
        <a
          href={`/admissoes/${admission.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-meta font-semibold text-wg-green-dark hover:underline"
        >
          Ver admissão
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-meta text-wg-ink-muted">
        {admission.stage && <StageBadge color={admission.stage.color}>{admission.stage.name}</StageBadge>}
        {admission.digitalFormSubmittedAt ? (
          <StatusBadge tone="success">Formulário preenchido</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Formulário pendente</StatusBadge>
        )}
        {admission.startDate && <span>Início previsto: {formatDate(admission.startDate)}</span>}
      </div>
    </Section>
  );
}
