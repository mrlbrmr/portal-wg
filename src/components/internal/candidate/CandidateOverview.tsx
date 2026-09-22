"use client";

import { ArrowRight, Check, ExternalLink, Pencil, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InfoHint } from "@/components/ui/InfoHint";
import { Skeleton } from "@/components/ui/Skeleton";
import { StageBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { cn, formatDate } from "@/lib/utils";
import { AI_FIT_BAND_META, MATCH_BASIS_HINT, type AiAnalysis } from "@/lib/recruitment/ai-analysis";
import { formatExperience } from "@/lib/recruitment/candidate-presentation";
import { CandidateEditForm, type CandidateProfilePatch } from "./CandidateEditForm";
import { ApplicationDetails, CandidateContact } from "./CandidateSummary";
import { ResumeCard } from "./ResumeCard";
import { Section } from "./Section";
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
  onCopy: (label: "E-mail" | "Telefone", value: string) => Promise<boolean>;
}

const linkAction =
  "inline-flex items-center gap-1 rounded-control text-meta font-medium text-wg-green-dark underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50";

/**
 * Visão geral orientada à decisão: primeiro a aderência e o que sustenta a leitura
 * (fatos-chave, competências, pontos fortes/atenção); depois currículo, contato e dados
 * administrativos. Tudo vem da candidatura e da análise existente — dado ausente fica
 * discreto ou some, nunca com o mesmo peso de um dado preenchido.
 */
export function CandidateOverview(props: Props) {
  const { data, analysis, wide } = props;

  const decision = (
    <div className="space-y-4">
      <MatchSummary {...props} />
      <KeyFacts data={data} analysis={analysis} canManage={props.canManage} onEdit={props.onEdit} />
      <Skills data={data} analysis={analysis} />
      {analysis && <Highlights analysis={analysis} />}
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

const MATCH_BOX = "rounded-card bg-wg-bg/70 px-4 py-3";

function MatchLabel() {
  return (
    <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-wg-ink-muted">
      Aderência ao perfil
      <InfoHint text={MATCH_BASIS_HINT} label="Como a aderência é calculada" align="left" />
    </p>
  );
}

function MatchSummary({ data, analysis, analysisLoading, canManage, analyzing, onAnalyze, onOpenEvaluations }: Props) {
  if (analysisLoading && !analysis) {
    return (
      <div className={MATCH_BOX} aria-busy="true" aria-label="Carregando aderência">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-6 w-48" />
      </div>
    );
  }

  // Antes da análise: uma faixa baixa, com o motivo e o CTA na mesma linha.
  if (!analysis || analysis.score === null) {
    const isPdf = !!data.resumeName?.toLowerCase().endsWith(".pdf");
    const canAnalyze = canManage && isPdf;
    return (
      <section aria-label="Aderência ao perfil" className={cn(MATCH_BOX, "flex flex-wrap items-center gap-x-4 gap-y-2")}>
        <div className="min-w-0 flex-1 basis-56">
          <MatchLabel />
          <p className="mt-0.5 text-body font-medium text-wg-ink">
            {!data.resumeName
              ? "Sem currículo anexado."
              : !isPdf
              ? "A análise automática só lê currículos em PDF."
              : "Ainda não analisamos este currículo."}
          </p>
          {canAnalyze && (
            <p className="text-[12px] text-wg-ink-muted">Analise para ver compatibilidade, competências e pontos de atenção.</p>
          )}
        </div>
        {canAnalyze && (
          <Button size="sm" variant="secondary" icon={Sparkles} loading={analyzing} onClick={onAnalyze}>
            {analyzing ? "Analisando…" : "Analisar currículo"}
          </Button>
        )}
      </section>
    );
  }

  // Depois da análise: número, leitura descritiva, critérios atendidos (reais) e o caminho
  // para os fundamentos.
  const band = analysis.band ? AI_FIT_BAND_META[analysis.band] : null;
  const pct = Math.max(0, Math.min(100, analysis.score));
  const met = analysis.criteria.filter((c) => c.status === "MEETS").map((c) => c.criterion);

  return (
    <section aria-label="Aderência ao perfil" className={cn(MATCH_BOX, "animate-in fade-in-0 duration-200")}>
      <div className="flex items-start justify-between gap-3">
        <MatchLabel />
        <p className="shrink-0 text-[11.5px] text-wg-ink-muted">
          {formatDate(analysis.analyzedAt)}
          {analysis.engine && ` · IA: ${analysis.engine}`}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-sora text-[26px] font-semibold leading-none tabular-nums text-wg-ink">{pct}%</p>
        {band && <p className="min-w-0 text-body text-wg-ink-secondary">{band.summary}</p>}
      </div>
      <div
        role="meter"
        aria-label="Aderência ao perfil"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-1 overflow-hidden rounded-full bg-[#E3EADA]"
      >
        <div className="h-full rounded-full bg-wg-green-dark/70" style={{ width: `${pct}%` }} />
      </div>
      {met.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Critérios da vaga atendidos">
          {met.map((c) => (
            <li
              key={c}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[12px] text-wg-ink-secondary shadow-[inset_0_0_0_1px_#DCE8CC]"
            >
              <Check className="h-3 w-3 text-success" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      )}
      {analysis.profileSummary && <p className="mt-2.5 text-meta text-wg-ink-secondary">{analysis.profileSummary}</p>}
      <button type="button" onClick={onOpenEvaluations} className={cn(linkAction, "mt-2")}>
        Ver análise completa
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </section>
  );
}

// ── Fatos-chave ──────────────────────────────────────────────────────────────

function KeyFacts({
  data,
  analysis,
  canManage,
  onEdit,
}: {
  data: CandidateDetail;
  analysis: AiAnalysis | null;
  canManage: boolean;
  onEdit: () => void;
}) {
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
  const filled = facts.filter((f) => f.value);
  const missing = facts.filter((f) => !f.value).map((f) => f.label);

  // Nada preenchido: uma linha, não quatro cards de "Não informado".
  if (filled.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-dashed border-wg-border-light px-3 py-2">
        <p className="text-meta text-wg-ink-muted">Informações profissionais não preenchidas.</p>
        {canManage && (
          <Button size="sm" variant="tertiary" icon={Pencil} onClick={onEdit}>
            Editar dados
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <dl
        className={cn(
          "grid grid-cols-2 gap-2",
          filled.length >= 4 ? "sm:grid-cols-4" : filled.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
        )}
      >
        {filled.map((f) => (
          <div key={f.label} className="min-w-0 rounded-control bg-wg-bg/60 px-3 py-2">
            <dt className="text-[11.5px] text-wg-ink-muted">{f.label}</dt>
            <dd className="mt-0.5 min-w-0">
              <span className="block truncate text-body font-medium text-wg-ink" title={f.value ?? undefined}>
                {f.value}
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
      {missing.length > 0 && (
        <p className="mt-1.5 text-[12px] text-wg-ink-muted">
          Não informado: {missing.join(" · ")}
        </p>
      )}
    </div>
  );
}

// ── Competências ─────────────────────────────────────────────────────────────

function Skills({ data, analysis }: { data: CandidateDetail; analysis: AiAnalysis | null }) {
  const fromCv = (data.cv_profile?.skills ?? []).filter((s) => typeof s === "string" && s.trim());
  const skills = [...new Set((fromCv.length > 0 ? fromCv : analysis?.profile.skills ?? []).map((s) => s.trim()))];
  if (skills.length === 0) return null;
  return (
    <section aria-labelledby="qv-skills">
      <h3 id="qv-skills" className="mb-1.5 text-[13px] font-semibold text-wg-ink">
        Competências identificadas
        <span className="ml-1.5 text-[12px] font-normal text-wg-ink-muted">extraídas do currículo</span>
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <li key={s} className="rounded-full border border-wg-border-light bg-white px-2.5 py-0.5 text-[12px] text-wg-ink-secondary">
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Pontos fortes × atenção ──────────────────────────────────────────────────

const MAX_HIGHLIGHTS = 3;

function Highlights({ analysis }: { analysis: AiAnalysis }) {
  if (analysis.strengths.length === 0 && analysis.gaps.length === 0) return null;
  return (
    <section aria-label="Pontos fortes e pontos de atenção" className="grid gap-4 sm:grid-cols-2">
      <HighlightList title="Pontos fortes" items={analysis.strengths} kind="strength" />
      <HighlightList title="Pontos de atenção" items={analysis.gaps} kind="attention" />
    </section>
  );
}

function HighlightList({ title, items, kind }: { title: string; items: string[]; kind: "strength" | "attention" }) {
  const Icon = kind === "strength" ? Check : TriangleAlert;
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-[13px] font-semibold text-wg-ink">{title}</h3>
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
          className="inline-flex items-center gap-1 rounded-control text-meta font-semibold text-wg-green-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
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
