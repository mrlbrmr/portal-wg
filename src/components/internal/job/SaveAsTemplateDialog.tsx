"use client";

// "Salvar como modelo" (menu de ações da vaga). Copia para um modelo novo só o que se
// repete no cargo — nunca candidatos, datas, status, publicação, solicitação, posições,
// motivo, salário ou histórico (regra em templateFromJob, src/lib/jobs/templates.ts).

import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { createJobTemplate } from "@/lib/jobs/template-actions";
import { actionErrorMessage } from "@/lib/action-errors";
import { templateFromJob, type SaveAsTemplateOptions, type TemplateTarget } from "@/lib/jobs/templates";
import { Field, inputClass } from "./JobFields";

type Include = SaveAsTemplateOptions["include"];

const INCLUDE_OPTIONS: Array<{ key: keyof Include; label: string; hint: string }> = [
  { key: "general", label: "Dados gerais", hint: "Tipo de contratação e horário." },
  { key: "content", label: "Conteúdo da vaga", hint: "O texto inteiro, como está no editor (responsabilidades, requisitos, benefícios…)." },
];

export function SaveAsTemplateDialog({
  open,
  onClose,
  job,
}: {
  open: boolean;
  onClose: () => void;
  job: Pick<TemplateTarget, "title" | "department" | "contractType" | "workSchedule" | "content">;
}) {
  const id = useId();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(job.title);
  const [department, setDepartment] = useState(job.department);
  const [include, setInclude] = useState<Include>({ general: true, content: true });
  const [error, setError] = useState<string | null>(null);

  // Cada abertura do diálogo parte dos dados atuais da vaga.
  useEffect(() => {
    if (!open) return;
    setName(job.title);
    setDepartment(job.department);
    setInclude({ general: true, content: true });
    setError(null);
  }, [open, job.title, job.department]);

  function save() {
    if (name.trim().length < 2) return setError("Informe o nome do modelo.");
    setError(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof createJobTemplate>>;
      try {
        res = await createJobTemplate(templateFromJob(job, { name, department, include }));
      } catch (e) {
        console.error("[salvar-como-modelo]", e);
        setError(actionErrorMessage(e));
        return;
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      notify("success", `Modelo “${res.template.name}” salvo. Ele já aparece em Nova vaga.`);
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={pending}
      title="Salvar como modelo"
      description="Os dados são copiados para um modelo novo. Esta vaga não muda e não fica ligada ao modelo."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" loading={pending} onClick={save}>
            Salvar modelo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor={`${id}-name`} required>
            <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputClass} />
          </Field>
          <Field label="Área" htmlFor={`${id}-dep`}>
            <input id={`${id}-dep`} value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={120} className={inputClass} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-wg-ink-secondary">Campos incluídos</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {INCLUDE_OPTIONS.map((o) => (
              <label
                key={o.key}
                className="flex cursor-pointer items-start gap-2.5 rounded-control border border-wg-border-light bg-white px-3 py-2 hover:bg-wg-bg"
              >
                <input
                  type="checkbox"
                  checked={include[o.key]}
                  onChange={(e) => setInclude((i) => ({ ...i, [o.key]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-wg-green"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-wg-ink">{o.label}</span>
                  {o.hint && <span className="block text-[12px] text-wg-ink-muted">{o.hint}</span>}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-wg-ink-muted">
            Nunca entram no modelo: candidatos, datas, status, publicação, solicitação, posições, motivo, salário e histórico.
          </p>
        </fieldset>
        {error && (
          <p role="alert" className="rounded-control border border-danger-border bg-danger-bg px-3 py-2 text-meta text-danger-fg">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
