"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardCheck,
  Download,
  Loader2,
  Paperclip,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDate } from "@/lib/utils";
import {
  ASSESSMENT_KIND_LABELS,
  ASSESSMENT_OUTCOME_BADGE,
  ASSESSMENT_OUTCOME_LABELS,
  MANUAL_ASSESSMENT_KINDS,
} from "@/lib/assessment-schema";

interface Assessment {
  id: string;
  kind: string;
  source: string;
  title: string | null;
  score: number | null;
  outcome: string | null;
  summary: string | null;
  evaluator: string | null;
  attachmentName: string | null;
  occurredAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30";

const MAX_MB = 10;
const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg";

interface Props {
  applicationId: string;
  canManage: boolean;
  hasResume?: boolean;
}

/**
 * Seção "Avaliações" da ficha do candidato: lista cronológica de entrevistas/
 * testes (tipo, nota, parecer, avaliador, data, anexo) + formulário para
 * registrar. Avaliações de IA (source=AI) aparecem com selo próprio.
 */
export function AssessmentsSection({ applicationId, canManage, hasResume }: Props) {
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Assessment[] | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [kind, setKind] = useState<string>(MANUAL_ASSESSMENT_KINDS[0]);
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [evaluator, setEvaluator] = useState("");
  const [score, setScore] = useState("");
  const [outcome, setOutcome] = useState("");
  const [summary, setSummary] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/applications/${applicationId}/assessments`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { assessments: Assessment[] }) => setItems(d.assessments))
      .catch(() => setItems([]));
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setKind(MANUAL_ASSESSMENT_KINDS[0]);
    setOccurredAt(new Date().toISOString().slice(0, 10));
    setEvaluator("");
    setScore("");
    setOutcome("");
    setSummary("");
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      data.set("kind", kind);
      if (occurredAt) data.set("occurredAt", occurredAt);
      if (evaluator.trim()) data.set("evaluator", evaluator.trim());
      if (score.trim()) data.set("score", score.trim());
      if (outcome) data.set("outcome", outcome);
      if (summary.trim()) data.set("summary", summary.trim());
      const file = fileRef.current?.files?.[0];
      if (file) data.set("attachment", file);

      const res = await fetch(`/api/applications/${applicationId}/assessments`, {
        method: "POST",
        credentials: "same-origin",
        body: data,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        notify("error", typeof j.error === "string" ? j.error : "Não foi possível registrar.");
        return;
      }
      notify("success", "Avaliação registrada.");
      setOpen(false);
      resetForm();
      load();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function runAiAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/analyze`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify("error", typeof json.error === "string" ? json.error : "Erro na análise de IA.");
        return;
      }
      notify("success", "Análise de IA concluída.");
      load();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function remove(assessmentId: string) {
    const prev = items;
    setItems((list) => (list ? list.filter((a) => a.id !== assessmentId) : list));
    try {
      const res = await fetch(`/api/applications/${applicationId}/assessments/${assessmentId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setItems(prev);
        notify("error", "Erro ao excluir a avaliação.");
        return;
      }
      notify("success", "Avaliação excluída.");
    } catch {
      setItems(prev);
      notify("error", "Erro de conexão.");
    }
  }

  function renderSummary(text: string) {
    return (
      <div className="mt-1.5 space-y-0.5">
        {text.split("\n").map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-1" />;
          const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ");
          const content = isBullet ? trimmed.slice(2) : trimmed;
          const richContent = content.split(/(\*\*[^*]+\*\*)/).map((chunk, j) =>
            chunk.startsWith("**") && chunk.endsWith("**") ? (
              <strong key={j} className="font-semibold text-gray-800">
                {chunk.slice(2, -2)}
              </strong>
            ) : (
              chunk
            )
          );
          if (isBullet) {
            return (
              <div key={i} className="flex gap-1.5 items-start text-xs text-gray-600">
                <span className="text-wg-green font-bold mt-px shrink-0">•</span>
                <span>{richContent}</span>
              </div>
            );
          }
          return (
            <p key={i} className="text-xs text-gray-600">
              {richContent}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Avaliações</h3>
          {items && items.length > 0 && (
            <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-500">{items.length}</span>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            {hasResume && (
              <button
                type="button"
                onClick={runAiAnalysis}
                disabled={analyzing}
                className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:opacity-80 disabled:opacity-50"
                title="Analisa o currículo e pontua a aderência à vaga com IA"
              >
                {analyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {analyzing ? "Analisando…" : "Analisar com IA"}
              </button>
            )}
            {!open && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-wg-green-dark hover:opacity-80"
              >
                <Plus className="h-3.5 w-3.5" />
                Registrar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Formulário */}
      {open && canManage && (
        <form onSubmit={submit} className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Nova avaliação</span>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-500">
              Tipo
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
                {MANUAL_ASSESSMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ASSESSMENT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Data
              <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={inputClass} />
            </label>
            <label className="text-xs text-gray-500">
              Avaliador
              <input
                value={evaluator}
                onChange={(e) => setEvaluator(e.target.value)}
                placeholder="Você"
                className={inputClass}
              />
            </label>
            <label className="text-xs text-gray-500">
              Nota (0–100)
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="—"
                className={inputClass}
              />
            </label>
            <label className="col-span-2 text-xs text-gray-500">
              Parecer
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputClass}>
                <option value="">— Sem parecer —</option>
                {Object.keys(ASSESSMENT_OUTCOME_LABELS).map((o) => (
                  <option key={o} value={o}>
                    {ASSESSMENT_OUTCOME_LABELS[o]}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 text-xs text-gray-500">
              Observações
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="Como foi a entrevista/teste..."
                className={`${inputClass} resize-y`}
              />
            </label>
          </div>

          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-500 hover:border-wg-green hover:text-wg-green-dark">
            {fileName ? <Paperclip className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            <span className="truncate">{fileName ?? `Anexar resultado (opcional, até ${MAX_MB} MB)`}</span>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="hidden"
            />
          </label>

          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-wg-green px-3 py-1.5 text-xs font-semibold text-black hover:bg-wg-green-bright disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Salvar avaliação
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      {items === null ? (
        <p className="text-sm text-gray-400">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma avaliação registrada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <li key={a.id} className="group rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {a.source === "AI" ? (
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  ) : (
                    <ClipboardCheck className="h-3.5 w-3.5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {a.title || ASSESSMENT_KIND_LABELS[a.kind] || a.kind}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {a.score !== null && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-700">
                      <Star className="h-3 w-3 text-amber-400" />
                      {a.score}/100
                    </span>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="text-gray-300 hover:text-red-600 group-hover:text-gray-400"
                      title="Excluir avaliação"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{ASSESSMENT_KIND_LABELS[a.kind] ?? a.kind}</span>
                {a.outcome && (() => {
                  // IA com score → "Analisada"
                  const isAiDone = a.source === "AI" && a.score !== null && a.outcome === "PENDING";
                  // Personalidade (auto-inserida pelo submit) com outcome PENDING → "Concluído"
                  const isPersonalityDone =
                    a.kind === "PERSONALITY_TEST" &&
                    a.outcome === "PENDING" &&
                    a.evaluator === "Automático";
                  const label = isAiDone
                    ? "Analisada"
                    : isPersonalityDone
                    ? "Concluído"
                    : (ASSESSMENT_OUTCOME_LABELS[a.outcome] ?? a.outcome);
                  const cls = isAiDone || isPersonalityDone
                    ? "bg-blue-50 text-blue-700"
                    : (ASSESSMENT_OUTCOME_BADGE[a.outcome] ?? "bg-gray-100 text-gray-600");
                  return (
                    <span className={`rounded-full px-1.5 py-0.5 font-medium ${cls}`}>
                      {label}
                    </span>
                  );
                })()}
                <span>· {formatDate(a.occurredAt ?? a.createdAt)}</span>
                {a.evaluator && <span>· {a.evaluator}</span>}
              </div>

              {a.summary && renderSummary(a.summary)}

              {a.attachmentName && (
                <a
                  href={`/api/applications/${applicationId}/assessments/${a.id}/file`}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-wg-green-dark hover:opacity-80"
                >
                  <Download className="h-3 w-3" />
                  {a.attachmentName}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
