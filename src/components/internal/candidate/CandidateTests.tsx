"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, ChevronUp, Copy, ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge, type Tone } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { BigFiveBars, BigFiveRadar } from "@/components/internal/BigFiveChart";
import { parseBigFive } from "@/lib/avaliacoes/big-five";
import { resolveAssessmentType } from "@/lib/avaliacoes/schema";
import {
  APPLICATION_STATUS,
  RESULT_SITUATION,
  applicationStatus,
  isBehavioral,
  resultSituation,
} from "@/lib/avaliacoes/presentation";
import { formatDate } from "@/lib/utils";
import { Section } from "./Section";
import type { Loadable, TestSession } from "./types";

interface TemplateOption {
  id: string;
  name: string;
  kind: string;
  estimatedMin: number | null;
}

interface Props {
  applicationId: string;
  sessions: Loadable<TestSession>;
  canManage: boolean;
  /** Template sugerido (etapa de teste atual). */
  defaultTemplateId?: string | null;
  onChanged: () => void;
}

const sessionType = (s: TestSession) =>
  resolveAssessmentType({ assessmentType: s.template?.assessmentType, kind: s.template?.kind ?? "" });

/** Mesmo vocabulário de Avaliações → Aplicações/Resultados (decidido pelo tipo do teste). */
function sessionStatus(s: TestSession): { label: string; tone: Tone } {
  const type = sessionType(s);
  if (s.submittedAt) return RESULT_SITUATION[resultSituation(s, type)];
  return APPLICATION_STATUS[applicationStatus(s, type)];
}

/**
 * "Testes online": links de avaliação enviados ao candidato. Vazio = uma linha e o botão
 * de enviar; com testes, uma linha por envio (status, envio, conclusão, resultado).
 */
export function CandidateTests({ applicationId, sessions, canManage, defaultTemplateId, onChanged }: Props) {
  const { notify } = useToast();
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [templateId, setTemplateId] = useState(defaultTemplateId ?? "");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openForm = () => {
    if (templates === null) {
      fetch("/api/assessment-templates", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: TemplateOption[]) => setTemplates(d ?? []))
        .catch(() => {
          setTemplates([]);
          notify("error", "Não foi possível carregar os testes disponíveis.");
        });
    }
    setTemplateId(defaultTemplateId ?? "");
    setFormOpen(true);
  };

  const create = async () => {
    if (!templateId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/assessment-sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, templateId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!res.ok) {
        notify("error", data.error ?? "Erro ao criar o link do teste.");
        return;
      }
      if (data.url) navigator.clipboard?.writeText(data.url).catch(() => {});
      notify("success", "Link do teste criado e copiado. Envie ao candidato.");
      setFormOpen(false);
      onChanged();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (s: TestSession) => {
    navigator.clipboard?.writeText(`${window.location.origin}/avaliacao/${s.token}`).catch(() => {});
    setCopiedId(s.id);
    setTimeout(() => setCopiedId((id) => (id === s.id ? null : id)), 2000);
  };

  const items = sessions.items;

  return (
    <Section
      title="Testes online"
      meta={items && items.length > 0 ? <span className="text-meta font-normal tabular-nums text-wg-ink-muted">{items.length}</span> : null}
      action={
        canManage &&
        !formOpen &&
        items && items.length > 0 && (
          <Button size="sm" variant="tertiary" icon={Plus} onClick={openForm}>
            Enviar teste
          </Button>
        )
      }
    >
      {formOpen && canManage && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-control bg-wg-bg/70 p-3">
          <label className="min-w-0 flex-1 basis-56 text-[12px] font-medium text-wg-ink-muted">
            Teste
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={templates === null}
              className="mt-1 h-9 w-full rounded-control border border-wg-border-light bg-white px-2.5 text-body text-wg-ink outline-none focus:border-wg-green focus:ring-2 focus:ring-wg-green/30"
            >
              <option value="">{templates === null ? "Carregando…" : "Selecione um teste"}</option>
              {(templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.estimatedMin ? ` (${t.estimatedMin} min)` : ""}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" onClick={create} loading={creating} disabled={!templateId}>
            Criar link e copiar
          </Button>
          <Button variant="tertiary" size="icon" onClick={() => setFormOpen(false)} aria-label="Cancelar envio de teste">
            <X aria-hidden />
          </Button>
        </div>
      )}

      {items === null ? (
        <Skeleton className="h-9 w-full" />
      ) : sessions.error && items.length === 0 ? (
        <p className="text-body text-danger-fg">Não foi possível carregar os testes.</p>
      ) : items.length === 0 ? (
        !formOpen && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-meta text-wg-ink-muted">Nenhum teste enviado.</p>
            {canManage && (
              <Button size="sm" variant="secondary" icon={Plus} onClick={openForm}>
                Enviar teste
              </Button>
            )}
          </div>
        )
      ) : (
        <ul className="space-y-1">
          {items.map((s) => {
            const status = sessionStatus(s);
            const behavioral = isBehavioral(sessionType(s));
            const bf = behavioral ? parseBigFive(s.scoreBreakdown) : null;
            const isOpen = expandedId === s.id;
            return (
              <li key={s.id} className="py-1.5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-body font-medium text-wg-ink">{s.template?.name ?? "Teste removido"}</span>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      {!behavioral && s.score !== null && (
                        <span className="text-meta font-semibold tabular-nums text-wg-ink">{Math.round(s.score)}%</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-wg-ink-muted">
                      Enviado em {formatDate(s.createdAt)}
                      {s.sentBy && ` por ${s.sentBy}`}
                      {s.submittedAt && ` · Concluído em ${formatDate(s.submittedAt)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {s.submittedAt && (
                      <Button
                        size="icon-sm"
                        variant="tertiary"
                        onClick={() => setExpandedId(isOpen ? null : s.id)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? "Ocultar resultado" : "Ver resultado"}
                        title={isOpen ? "Ocultar resultado" : "Ver resultado"}
                      >
                        {isOpen ? <ChevronUp aria-hidden /> : <BarChart3 aria-hidden />}
                      </Button>
                    )}
                    {!s.submittedAt && (
                      <a
                        href={`/avaliacao/${s.token}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Abrir link do teste"
                        title="Abrir link do teste"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-control text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    )}
                    <Button
                      size="icon-sm"
                      variant="tertiary"
                      onClick={() => copyLink(s)}
                      aria-label="Copiar link do teste"
                      title="Copiar link do teste"
                    >
                      {copiedId === s.id ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
                    </Button>
                  </div>
                </div>

                {isOpen && s.submittedAt && (
                  <div className="mt-2 rounded-control bg-wg-bg/70 p-3">
                    {bf ? (
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="mx-auto shrink-0 sm:mx-0">
                          <BigFiveRadar scores={bf} size={180} />
                        </div>
                        <div className="flex-1">
                          <BigFiveBars scores={bf} />
                        </div>
                      </div>
                    ) : s.score !== null ? (
                      <div>
                        <div className="mb-1 flex justify-between text-meta">
                          <span className="text-wg-ink-muted">Nota</span>
                          <span className="font-semibold tabular-nums text-wg-ink">{Math.round(s.score)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#E3EADA]">
                          <div className="h-full rounded-full bg-wg-green-dark/70" style={{ width: `${Math.max(0, Math.min(100, s.score))}%` }} />
                        </div>
                      </div>
                    ) : !behavioral && s.outcome === "PENDING_REVIEW" ? (
                      <p className="text-meta text-warning-fg">Há questões dissertativas aguardando correção.</p>
                    ) : (
                      <p className="text-meta text-wg-ink-muted">Sem nota automática para este teste.</p>
                    )}
                    <Link
                      href={`/avaliacoes/resultados/${s.id}`}
                      className="mt-3 inline-flex items-center gap-1 text-meta font-medium text-wg-green-dark hover:underline"
                    >
                      {behavioral
                        ? "Ver perfil comportamental"
                        : !behavioral && s.outcome === "PENDING_REVIEW" && canManage
                        ? "Corrigir dissertativas"
                        : "Abrir resultado completo"}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
