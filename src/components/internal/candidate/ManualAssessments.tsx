"use client";

import { useRef, useState } from "react";
import { ClipboardCheck, Download, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge, type Tone } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDate } from "@/lib/utils";
import { ASSESSMENT_KIND_LABELS, ASSESSMENT_OUTCOME_LABELS, MANUAL_ASSESSMENT_KINDS } from "@/lib/assessment-schema";
import { ConfirmDialog } from "./DialogShell";
import { Section } from "./Section";
import type { AssessmentItem, Loadable } from "./types";

const OUTCOME_TONE: Record<string, Tone> = {
  PENDING: "neutral",
  PASS: "success",
  RECOMMEND: "success",
  FAIL: "danger",
  REJECT: "danger",
};

const MAX_MB = 10;
const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg";

const field =
  "mt-1 w-full rounded-control border border-wg-border-light bg-white px-2.5 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30";

interface Props {
  applicationId: string;
  assessments: Loadable<AssessmentItem>;
  canManage: boolean;
  onChanged: () => void;
}

/**
 * "Avaliações registradas": entrevistas, testes aplicados fora do portal, referências.
 * A análise de IA tem seção própria e fica fora desta lista.
 */
export function ManualAssessments({ applicationId, assessments, canManage, onChanged }: Props) {
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AssessmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [kind, setKind] = useState<string>(MANUAL_ASSESSMENT_KINDS[0]);
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [evaluator, setEvaluator] = useState("");
  const [score, setScore] = useState("");
  const [outcome, setOutcome] = useState("");
  const [summary, setSummary] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const items = assessments.items?.filter((a) => a.source !== "AI") ?? null;

  const resetForm = () => {
    setKind(MANUAL_ASSESSMENT_KINDS[0]);
    setOccurredAt(new Date().toISOString().slice(0, 10));
    setEvaluator("");
    setScore("");
    setOutcome("");
    setSummary("");
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = new FormData();
      body.set("kind", kind);
      if (occurredAt) body.set("occurredAt", occurredAt);
      if (evaluator.trim()) body.set("evaluator", evaluator.trim());
      if (score.trim()) body.set("score", score.trim());
      if (outcome) body.set("outcome", outcome);
      if (summary.trim()) body.set("summary", summary.trim());
      const file = fileRef.current?.files?.[0];
      if (file) body.set("attachment", file);
      const res = await fetch(`/api/applications/${applicationId}/assessments`, { method: "POST", credentials: "same-origin", body });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: unknown };
        notify("error", typeof j.error === "string" ? j.error : "Não foi possível registrar a avaliação.");
        return;
      }
      notify("success", "Avaliação registrada.");
      setFormOpen(false);
      resetForm();
      onChanged();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/assessments/${toDelete.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error();
      notify("success", "Avaliação excluída.");
      setToDelete(null);
      onChanged();
    } catch {
      notify("error", "Não foi possível excluir a avaliação.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Section
      title="Avaliações registradas"
      meta={items && items.length > 0 ? <span className="text-meta font-normal tabular-nums text-wg-ink-muted">{items.length}</span> : null}
      action={
        canManage &&
        !formOpen && (
          <Button size="sm" variant="tertiary" icon={Plus} onClick={() => setFormOpen(true)}>
            Registrar avaliação
          </Button>
        )
      }
    >
      {formOpen && canManage && (
        <form onSubmit={submit} className="mb-3 rounded-control bg-wg-bg/70 p-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <label className="text-[12px] font-medium text-wg-ink-muted">
              Tipo
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${field} h-9`}>
                {MANUAL_ASSESSMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ASSESSMENT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] font-medium text-wg-ink-muted">
              Data
              <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={`${field} h-9`} />
            </label>
            <label className="text-[12px] font-medium text-wg-ink-muted">
              Avaliador
              <input value={evaluator} onChange={(e) => setEvaluator(e.target.value)} placeholder="Você" className={`${field} h-9`} />
            </label>
            <label className="text-[12px] font-medium text-wg-ink-muted">
              Nota (0–100)
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="—"
                className={`${field} h-9`}
              />
            </label>
            <label className="col-span-2 text-[12px] font-medium text-wg-ink-muted">
              Parecer
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={`${field} h-9`}>
                <option value="">Sem parecer</option>
                {Object.keys(ASSESSMENT_OUTCOME_LABELS).map((o) => (
                  <option key={o} value={o}>
                    {ASSESSMENT_OUTCOME_LABELS[o]}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 text-[12px] font-medium text-wg-ink-muted">
              Observações
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="Como foi a entrevista ou o teste…"
                className={`${field} resize-y py-2`}
              />
            </label>
          </div>
          <label className="mt-2.5 flex cursor-pointer items-center gap-2 rounded-control border border-dashed border-wg-border-light bg-white px-2.5 py-2 text-meta text-wg-ink-muted transition-colors hover:border-wg-green hover:text-wg-green-dark focus-within:ring-2 focus-within:ring-wg-green/30">
            {fileName ? <Paperclip className="h-3.5 w-3.5" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
            <span className="truncate">{fileName ?? `Anexar resultado (opcional, até ${MAX_MB} MB)`}</span>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="sr-only"
            />
          </label>
          <div className="mt-2.5 flex justify-end gap-2">
            <Button
              variant="tertiary"
              onClick={() => {
                setFormOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Salvar avaliação
            </Button>
          </div>
        </form>
      )}

      {items === null ? (
        <Skeleton className="h-9 w-full" />
      ) : assessments.error && items.length === 0 ? (
        <p className="text-body text-danger-fg">Não foi possível carregar as avaliações.</p>
      ) : items.length === 0 ? (
        !formOpen && <p className="text-meta text-wg-ink-muted">Nenhuma avaliação registrada.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((a) => (
            <li key={a.id} className="group py-1.5">
              <div className="flex items-start gap-3">
                <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-wg-ink-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-body font-medium text-wg-ink">{a.title || ASSESSMENT_KIND_LABELS[a.kind] || a.kind}</span>
                    {a.outcome && (
                      <StatusBadge tone={OUTCOME_TONE[a.outcome] ?? "neutral"}>
                        {a.kind === "PERSONALITY_TEST" && a.outcome === "PENDING" && a.evaluator === "Automático"
                          ? "Concluído"
                          : ASSESSMENT_OUTCOME_LABELS[a.outcome] ?? a.outcome}
                      </StatusBadge>
                    )}
                    {a.score !== null && <span className="text-meta font-semibold tabular-nums text-wg-ink">{Math.round(a.score)}/100</span>}
                  </div>
                  <p className="mt-0.5 text-[12px] text-wg-ink-muted">
                    {ASSESSMENT_KIND_LABELS[a.kind] ?? a.kind} · {formatDate(a.occurredAt ?? a.createdAt)}
                    {a.evaluator && ` · ${a.evaluator}`}
                  </p>
                  {a.summary && <p className="mt-1 whitespace-pre-wrap text-meta text-wg-ink-secondary">{a.summary}</p>}
                  {a.attachmentName && (
                    <a
                      href={`/api/applications/${applicationId}/assessments/${a.id}/file`}
                      className="mt-1 inline-flex items-center gap-1 text-meta font-medium text-wg-green-dark hover:underline"
                    >
                      <Download className="h-3 w-3" aria-hidden />
                      {a.attachmentName}
                    </a>
                  )}
                </div>
                {canManage && (
                  <Button
                    size="icon-sm"
                    variant="tertiary"
                    onClick={() => setToDelete(a)}
                    aria-label={`Excluir avaliação ${a.title || ASSESSMENT_KIND_LABELS[a.kind] || ""}`.trim()}
                    title="Excluir avaliação"
                    className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir avaliação?"
        description="O registro e o anexo, se houver, serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir avaliação"
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void remove()}
      />
    </Section>
  );
}
