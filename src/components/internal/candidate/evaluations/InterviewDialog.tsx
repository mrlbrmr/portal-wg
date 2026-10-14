"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { ChevronDown, ClipboardPaste, LayoutTemplate, ListChecks, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { TONE_DOT } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import { INTERVIEW_TYPES, RECOMMENDATIONS, interviewTypeLabel, recommendationInfo } from "@/lib/recruitment/evaluations/catalog";
import { docFromPlainText, docToPlainText, isReportDoc, type ReportDoc } from "@/lib/recruitment/evaluations/document";
import { markdownToEditorHtml } from "@/lib/recruitment/evaluations/markdown";
import { todayISO } from "@/lib/recruitment/evaluations/schema";
import { REPORT_TEMPLATES, templateDoc, type ReportTemplate } from "@/lib/recruitment/evaluations/templates";
import { ConfirmDialog, DialogShell } from "../DialogShell";
import type { AssessmentItem } from "../types";
import { ReportEditor } from "./ReportEditor";

interface Props {
  applicationId: string;
  candidateName: string;
  jobTitle?: string | null;
  /** Requisitos da vaga — consulta durante a escrita (recolhível). */
  criteria: string[];
  defaultEvaluator: string;
  /** Edição de uma entrevista existente (null = nova). */
  existing: AssessmentItem | null;
  onClose: () => void;
  onSaved: (item: AssessmentItem, created: boolean) => void;
}

const field =
  "mt-1 h-9 w-full rounded-control border border-wg-border-light bg-white px-2.5 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30";
const labelCls = "block text-[12px] font-medium text-wg-ink-muted";

const EMPTY_DOC: ReportDoc = { type: "doc", content: [{ type: "paragraph" }] };

function initialDoc(existing: AssessmentItem | null): ReportDoc {
  if (!existing) return EMPTY_DOC;
  if (isReportDoc(existing.content)) return existing.content;
  // Entrevista antiga: o parecer era texto puro em `summary`.
  return existing.summary?.trim() ? docFromPlainText(existing.summary) : EMPTY_DOC;
}

/**
 * Registrar/editar ENTREVISTA — que é o próprio parecer: tipo, data, entrevistador,
 * recomendação (dado estruturado) e o documento. Modal grande por cima do Quick View,
 * com o editor como protagonista. Alterações não salvas pedem confirmação ao sair.
 */
export function InterviewDialog({ applicationId, candidateName, jobTitle, criteria, defaultEvaluator, existing, onClose, onSaved }: Props) {
  const { notify } = useToast();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const startDoc = useMemo(() => initialDoc(existing), [existing]);
  const initial = useMemo(
    () => ({
      interviewType: existing?.interviewType ?? (existing ? "OTHER" : "HR"),
      occurredAt: existing?.occurredAt?.slice(0, 10) ?? todayISO(),
      evaluator: existing?.evaluator ?? defaultEvaluator,
      recommendation: existing?.recommendation ?? "UNDEFINED",
      title: existing?.title && existing.title !== interviewTypeLabel(existing.interviewType) && existing.title !== "Entrevista" ? existing.title : "",
    }),
    [existing, defaultEvaluator]
  );
  const [form, setForm] = useState(initial);
  const [doc, setDoc] = useState<ReportDoc>(startDoc);
  const [docDirty, setDocDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<ReportTemplate | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  const dirty = docDirty || (Object.keys(initial) as Array<keyof typeof initial>).some((k) => form[k] !== initial[k]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };

  const onReady = useCallback((e: Editor | null) => {
    editorRef.current = e;
  }, []);

  const onDocChange = useCallback((d: ReportDoc) => {
    setDoc(d);
    setDocDirty(true);
    setError(null);
  }, []);

  const editorHasText = () => (editorRef.current ? editorRef.current.getText().trim().length > 0 : docToPlainText(doc).trim().length > 0);

  // ── Sair: confirma quando há alteração não salva (também ao fechar/recarregar a aba) ──
  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmLeave(true);
    else onClose();
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Foco inicial no tipo; o foco volta para quem abriu ao fechar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("select")?.focus();
    return () => previous?.focus?.();
  }, []);

  // ── Modelos e Markdown ──
  const applyTemplate = (t: ReportTemplate) => {
    const e = editorRef.current;
    if (!e) return;
    e.chain().focus().setContent(templateDoc(t), { emitUpdate: true }).run();
    setPendingTemplate(null);
  };
  const chooseTemplate = (t: ReportTemplate) => {
    if (editorHasText()) setPendingTemplate(t);
    else applyTemplate(t);
  };

  const insertMarkdown = (mode: "replace" | "append") => {
    const e = editorRef.current;
    const html = markdownToEditorHtml(pasteText);
    if (!e || !html) return;
    // Editor vazio: inserir = substituir (não sobra parágrafo em branco no fim).
    if (mode === "replace" || !editorHasText()) e.chain().focus().setContent(html, { emitUpdate: true }).run();
    else e.chain().focus("end").insertContent(html).run();
    setPasteOpen(false);
    setPasteText("");
    notify("success", "Parecer importado. Revise a formatação antes de salvar.");
  };

  // ── Salvar ──
  const save = async () => {
    if (saving) return;
    const content = (editorRef.current?.getJSON() as ReportDoc | undefined) ?? doc;
    if (!docToPlainText(content).trim()) {
      setError("Escreva o parecer antes de salvar.");
      editorRef.current?.commands.focus();
      return;
    }
    if (form.evaluator.trim().length < 2) {
      setError("Informe o entrevistador.");
      return;
    }
    setSaving(true);
    setError(null);
    const data = {
      kind: "INTERVIEW" as const,
      interviewType: form.interviewType,
      occurredAt: form.occurredAt,
      recommendation: form.recommendation,
      evaluator: form.evaluator,
      title: form.title.trim() || null,
      content,
    };
    try {
      const res = await fetch(
        existing ? `/api/applications/${applicationId}/assessments/${existing.id}` : `/api/applications/${applicationId}/assessments`,
        {
          method: existing ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existing ? { data, expectedUpdatedAt: existing.updatedAt } : data),
        }
      );
      const j = (await res.json().catch(() => ({}))) as { assessment?: AssessmentItem; error?: string };
      if (!res.ok || !j.assessment) {
        setError(j.error ?? "Não foi possível salvar o parecer.");
        return;
      }
      notify("success", existing ? "Parecer atualizado." : "Entrevista e parecer registrados.");
      onSaved(j.assessment, !existing);
    } catch {
      setError("Erro de conexão. O conteúdo continua aqui — tente salvar de novo.");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void save();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      requestClose();
    }
  };

  const rec = recommendationInfo(form.recommendation);

  return createPortal(
    <div data-dialog-shell className="fixed inset-0 z-[70] flex items-stretch justify-center sm:p-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-[#1A2213]/50" onClick={requestClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-[1040px] flex-col bg-white shadow-[0_24px_48px_rgba(26,34,19,.2)] sm:rounded-card sm:border sm:border-wg-border-lighter"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-wg-border-lighter px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="font-sora text-base font-semibold text-wg-ink">
              {existing ? "Editar entrevista" : "Registrar entrevista"}
            </h2>
            <p className="mt-0.5 truncate text-meta text-wg-ink-muted">
              {candidateName}
              {jobTitle && ` · ${jobTitle}`}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            aria-label="Fechar"
            className="rounded-control p-1 text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Corpo rolável: dados da entrevista + documento */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
          <div className="mx-auto max-w-[820px]">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <label className={labelCls}>
                Tipo da entrevista
                <select value={form.interviewType} onChange={(e) => set("interviewType", e.target.value)} className={field}>
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelCls}>
                Data da entrevista
                <input type="date" value={form.occurredAt} max={todayISO(new Date(Date.now() + 365 * 86_400_000))} onChange={(e) => set("occurredAt", e.target.value)} className={field} required />
              </label>
              <label className={labelCls}>
                Entrevistador
                <input value={form.evaluator} onChange={(e) => set("evaluator", e.target.value)} maxLength={120} className={field} autoComplete="off" />
              </label>
              <label className={labelCls}>
                Recomendação
                <span className="relative block">
                  <span className={cn("pointer-events-none absolute left-2.5 top-[calc(50%+2px)] h-2 w-2 -translate-y-1/2 rounded-full", TONE_DOT[rec.tone])} aria-hidden />
                  <select value={form.recommendation} onChange={(e) => set("recommendation", e.target.value)} className={cn(field, "pl-6")}>
                    {RECOMMENDATIONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>

            <label className="mt-4 block">
              <span className="sr-only">Título do parecer</span>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                maxLength={160}
                placeholder={interviewTypeLabel(form.interviewType)}
                className="w-full border-0 bg-transparent px-0 font-sora text-[22px] font-semibold text-wg-ink outline-none placeholder:text-wg-ink-muted/50"
              />
            </label>

            {criteria.length > 0 && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setCriteriaOpen((v) => !v)}
                  aria-expanded={criteriaOpen}
                  className="inline-flex items-center gap-1.5 text-meta font-medium text-wg-ink-muted hover:text-wg-ink"
                >
                  <ListChecks className="h-3.5 w-3.5" aria-hidden />
                  Critérios da vaga ({criteria.length})
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", criteriaOpen && "rotate-180")} aria-hidden />
                </button>
                {criteriaOpen && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-meta text-wg-ink-secondary">
                    {criteria.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-3 flex min-h-[420px] flex-col">
              <ReportEditor
                initialContent={startDoc}
                onChange={onDocChange}
                onReady={onReady}
                extraActions={
                  <>
                    <DropdownMenu
                      trigger={
                        <>
                          <LayoutTemplate aria-hidden />
                          <span className="hidden sm:inline">Usar modelo</span>
                        </>
                      }
                      triggerClassName={buttonVariants({ variant: "tertiary", size: "sm" })}
                      ariaLabel="Usar modelo"
                      title="Inserir a estrutura de um modelo de parecer"
                      portal
                      items={REPORT_TEMPLATES.map((t) => ({ label: t.label, hint: t.sections.length ? `${t.sections.length} seções` : undefined, onSelect: () => chooseTemplate(t) }))}
                    />
                    <Button size="sm" variant="tertiary" icon={ClipboardPaste} onClick={() => setPasteOpen(true)} title="Colar Markdown gerado no Claude/ChatGPT">
                      <span className="hidden sm:inline">Colar parecer gerado por IA</span>
                      <span className="sm:hidden">Colar</span>
                    </Button>
                  </>
                }
              />
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-wg-border-lighter px-4 py-3 sm:px-6">
          <p className={cn("min-w-0 text-meta", error ? "text-danger-fg" : "text-wg-ink-muted")} role={error ? "alert" : undefined} aria-live="polite">
            {error ?? (dirty ? "Alterações não salvas · Ctrl+S para salvar" : "Ctrl+S para salvar")}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={requestClose} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void save()} loading={saving}>
              Salvar parecer
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Descartar alterações?"
        description="O que foi escrito desde o último salvamento será perdido."
        confirmLabel="Descartar"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          onClose();
        }}
      />
      <ConfirmDialog
        open={pendingTemplate !== null}
        title="Substituir o conteúdo atual?"
        description={`O modelo "${pendingTemplate?.label ?? ""}" substitui o texto que já está no editor. Use Ctrl+Z para desfazer.`}
        confirmLabel="Substituir"
        onCancel={() => setPendingTemplate(null)}
        onConfirm={() => pendingTemplate && applyTemplate(pendingTemplate)}
      />
      <DialogShell
        open={pasteOpen}
        size="wide"
        title="Colar parecer gerado por IA"
        description="Cole o Markdown gerado no Claude ou no ChatGPT. Títulos, listas, tabelas e destaques são convertidos para o editor."
        onClose={() => setPasteOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasteOpen(false)}>
              Cancelar
            </Button>
            {editorHasText() && (
              <Button variant="secondary" onClick={() => insertMarkdown("replace")} disabled={!pasteText.trim()}>
                Substituir conteúdo
              </Button>
            )}
            <Button variant="primary" onClick={() => insertMarkdown("append")} disabled={!pasteText.trim()}>
              {editorHasText() ? "Adicionar ao final" : "Inserir no parecer"}
            </Button>
          </>
        }
      >
        <label htmlFor="paste-md" className="sr-only">
          Markdown do parecer
        </label>
        <textarea
          id="paste-md"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={16}
          spellCheck={false}
          placeholder={"# Parecer de entrevista\n\n## Síntese do perfil\n...\n\n| Critério | Avaliação | Evidência |\n| --- | --- | --- |\n| Comunicação | Forte | ... |"}
          className="w-full resize-y rounded-control border border-wg-border-light bg-white px-3 py-2 font-mono text-[12.5px] leading-relaxed text-wg-ink outline-none placeholder:text-wg-ink-muted/60 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30"
        />
      </DialogShell>
    </div>,
    document.body
  );
}
