"use client";

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TONE_DOT } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";

import { REFERENCE_RESULTS } from "@/lib/recruitment/evaluations/catalog";
import { todayISO } from "@/lib/recruitment/evaluations/schema";
import { DialogShell } from "../DialogShell";
import type { AssessmentItem } from "../types";

const field =
  "mt-1 h-9 w-full rounded-control border border-wg-border-light bg-white px-2.5 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30";
const area =
  "mt-1 w-full resize-y rounded-control border border-wg-border-light bg-white px-2.5 py-2 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30";
const labelCls = "block text-[12px] font-medium text-wg-ink-muted";
const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
// Mesmo limite de src/lib/assessment-storage.ts (módulo do servidor).
const MAX_ASSESSMENT_MB = 10;

interface BaseProps {
  applicationId: string;
  existing: AssessmentItem | null;
  onClose: () => void;
  onSaved: (item: AssessmentItem, created: boolean) => void;
}

async function send(
  applicationId: string,
  existing: AssessmentItem | null,
  data: Record<string, unknown>,
  file?: File | null
): Promise<{ item?: AssessmentItem; error?: string }> {
  const url = existing ? `/api/applications/${applicationId}/assessments/${existing.id}` : `/api/applications/${applicationId}/assessments`;
  let init: RequestInit;
  if (existing) {
    init = { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, expectedUpdatedAt: existing.updatedAt }) };
  } else if (file) {
    const form = new FormData();
    form.append("data", JSON.stringify(data));
    form.append("attachment", file);
    init = { method: "POST", body: form };
  } else {
    init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  }
  try {
    const res = await fetch(url, { ...init, credentials: "same-origin" });
    const j = (await res.json().catch(() => ({}))) as { assessment?: AssessmentItem; error?: string };
    if (!res.ok || !j.assessment) return { error: j.error ?? "Não foi possível salvar." };
    return { item: j.assessment };
  } catch {
    return { error: "Erro de conexão. Tente novamente." };
  }
}

/** Referência profissional: poucos campos, sem editor rico. */
export function ReferenceDialog({ applicationId, existing, onClose, onSaved }: BaseProps) {
  const { notify } = useToast();
  const [company, setCompany] = useState(existing?.referenceCompany ?? "");
  const [contact, setContact] = useState(existing?.referenceContact ?? "");
  const [relationship, setRelationship] = useState(existing?.referenceRelationship ?? "");
  const [day, setDay] = useState(existing?.occurredAt?.slice(0, 10) ?? todayISO());
  const [result, setResult] = useState(existing?.referenceResult ?? "");
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!result) {
      setError("Escolha o resultado da referência.");
      return;
    }
    setSaving(true);
    setError(null);
    const r = await send(applicationId, existing, {
      kind: "REFERENCE",
      referenceCompany: company,
      referenceContact: contact,
      referenceRelationship: relationship,
      occurredAt: day,
      referenceResult: result,
      summary,
    });
    setSaving(false);
    if (r.error || !r.item) {
      setError(r.error ?? "Não foi possível salvar.");
      return;
    }
    notify("success", existing ? "Referência atualizada." : "Referência registrada.");
    onSaved(r.item, !existing);
  };

  return (
    <DialogShell
      open
      title={existing ? "Editar referência" : "Registrar referência"}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto self-center text-meta text-danger-fg">
              {error}
            </p>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving}>
            Salvar referência
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className={labelCls}>
          Empresa
          <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={160} className={field} required />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            Pessoa contatada
            <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} className={field} required />
          </label>
          <label className={labelCls}>
            Cargo / relação com o candidato
            <input value={relationship} onChange={(e) => setRelationship(e.target.value)} maxLength={120} placeholder="Ex.: ex-gestora direta" className={field} />
          </label>
        </div>
        <label className={cn(labelCls, "sm:w-1/2 sm:pr-1.5")}>
          Data do contato
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} required />
        </label>
        <fieldset>
          <legend className={labelCls}>Resultado</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {REFERENCE_RESULTS.map((r) => (
              <label
                key={r.code}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-control border px-2.5 text-[13px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-wg-green/40",
                  result === r.code ? "border-wg-green-dark/40 bg-wg-hover-light font-medium text-wg-ink" : "border-wg-border-light text-wg-ink-secondary hover:bg-wg-bg"
                )}
              >
                <input type="radio" name="reference-result" value={r.code} checked={result === r.code} onChange={() => setResult(r.code)} className="sr-only" />
                <span className={cn("h-2 w-2 rounded-full", TONE_DOT[r.tone])} aria-hidden />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={labelCls}>
          Observações
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} maxLength={5000} className={area} />
        </label>
        <button type="submit" hidden />
      </form>
    </DialogShell>
  );
}

/** Avaliação externa (feita fora do Portal): o único registro com anexo. */
export function ExternalEvaluationDialog({ applicationId, existing, onClose, onSaved }: BaseProps) {
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [day, setDay] = useState(existing?.occurredAt?.slice(0, 10) ?? todayISO());
  const [evaluator, setEvaluator] = useState(existing?.evaluator ?? "");
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (file && file.size > MAX_ASSESSMENT_MB * 1024 * 1024) {
      setError(`O anexo excede ${MAX_ASSESSMENT_MB} MB.`);
      return;
    }
    setSaving(true);
    setError(null);
    const r = await send(applicationId, existing, { kind: "OTHER", title, occurredAt: day, evaluator, summary }, file);
    setSaving(false);
    if (r.error || !r.item) {
      setError(r.error ?? "Não foi possível salvar.");
      return;
    }
    notify("success", existing ? "Avaliação atualizada." : "Avaliação externa registrada.");
    onSaved(r.item, !existing);
  };

  return (
    <DialogShell
      open
      title={existing ? "Editar avaliação externa" : "Registrar avaliação externa"}
      description="Para avaliações feitas fora do Portal (ex.: teste prático da área, laudo, documento recebido). Testes do Portal aparecem sozinhos."
      onClose={onClose}
      busy={saving}
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto self-center text-meta text-danger-fg">
              {error}
            </p>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving}>
            Salvar avaliação
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className={labelCls}>
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Ex.: Teste prático de empilhadeira" className={field} required />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            Data
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} required />
          </label>
          <label className={labelCls}>
            Avaliador / origem
            <input value={evaluator} onChange={(e) => setEvaluator(e.target.value)} maxLength={120} className={field} />
          </label>
        </div>
        <label className={labelCls}>
          Observações
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} maxLength={5000} className={area} />
        </label>
        {existing ? (
          existing.attachmentName && (
            <p className="inline-flex items-center gap-1.5 text-meta text-wg-ink-muted">
              <Paperclip className="h-3.5 w-3.5" aria-hidden />
              {existing.attachmentName}
            </p>
          )
        ) : (
          <div>
            <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Anexo" />
            <Button size="sm" variant="secondary" icon={Paperclip} onClick={() => fileRef.current?.click()}>
              {file ? file.name : "Anexar arquivo"}
            </Button>
            <p className="mt-1 text-[11.5px] text-wg-ink-muted">PDF, DOC, DOCX, PNG ou JPG · até {MAX_ASSESSMENT_MB} MB.</p>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </DialogShell>
  );
}
