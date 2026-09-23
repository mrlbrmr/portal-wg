"use client";

// Criação AVULSA de vaga (/vagas/nova) — banco de talentos ou contratação autorizada fora
// do sistema. A vaga originada de uma solicitação não nasce aqui: ela é criada pela ação
// "Criar processo seletivo" (create_job_from_request, no banco), já com suas posições.
//
// Depois de criada, a vaga é gerida em /vagas/[id]/editar (JobWorkspace), onde o número de
// posições muda só por "Adicionar posição" / "Cancelar posição", com histórico.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Field,
  MarkdownEditor,
  OpportunityFields,
  SalaryFields,
  StatusSelect,
  draftToPayload,
  inputClass,
  jobToDraft,
  validateDraft,
  type JobDraft,
} from "@/components/internal/job/JobFields";

interface Props {
  /** Nome do recrutador logado — vira o "Recrutador responsável" por padrão. */
  currentUserName?: string | null;
}

export default function JobForm({ currentUserName }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [draft, setDraft] = useState<JobDraft>(() => jobToDraft(null, { responsible: currentUserName }));
  const [positions, setPositions] = useState("1");
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const patch = useCallback((p: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...p })), []);

  async function submit() {
    const invalid = validateDraft(draft);
    const count = Number(positions);
    if (invalid) return setError(invalid);
    if (!draft.isTalentPool && (!Number.isInteger(count) || count < 1 || count > 999)) {
      return setError("O número de posições deve ser um inteiro entre 1 e 999.");
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draftToPayload(draft), openings: draft.isTalentPool ? undefined : count }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string | { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
      };
      if (!res.ok || !body.id) {
        const e = body.error;
        setError(
          typeof e === "string"
            ? e
            : e?.fieldErrors && Object.keys(e.fieldErrors).length
              ? Object.values(e.fieldErrors).flat().join(", ")
              : e?.formErrors?.join(", ") || "Erro ao criar a vaga."
        );
        return;
      }
      setDone(true);
      notify("success", "Vaga criada.");
      router.push(`/vagas/${body.id}/editar`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="Dados da oportunidade">
        <OpportunityFields draft={draft} patch={patch} />
        {!draft.isTalentPool && (
          <div className="mt-4 max-w-xs">
            <Field
              label="Número de posições"
              htmlFor="new-job-positions"
              required
              hint="Número de profissionais que serão contratados por meio deste processo seletivo."
            >
              <input
                id="new-job-positions"
                type="number"
                min={1}
                max={999}
                value={positions}
                onChange={(e) => setPositions(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </Panel>

      <Panel title="Remuneração" description="O valor interno e a divulgação no portal são decisões separadas.">
        <SalaryFields draft={draft} patch={patch} />
      </Panel>

      <Panel title="Gestão do processo">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status do processo seletivo" htmlFor="new-job-status" required className="sm:col-span-2">
            <StatusSelect id="new-job-status" value={draft.status} onChange={(v) => patch({ status: v })} />
          </Field>
          <Field label="Recrutador responsável" htmlFor="new-job-resp">
            <input id="new-job-resp" value={draft.responsible} onChange={(e) => patch({ responsible: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Gestor solicitante" htmlFor="new-job-mgr" hint={draft.isTalentPool ? "Opcional em banco de talentos." : undefined}>
            <input id="new-job-mgr" value={draft.hiringManager} onChange={(e) => patch({ hiringManager: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Inscrições até" htmlFor="new-job-closing" hint="Após essa data, novas candidaturas serão bloqueadas.">
            <input id="new-job-closing" type="date" value={draft.closingDate} onChange={(e) => patch({ closingDate: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Contratação prevista até" htmlFor="new-job-deadline" hint="Meta interna para preenchimento das posições.">
            <input
              id="new-job-deadline"
              type="date"
              value={draft.hiringDeadline}
              onChange={(e) => patch({ hiringDeadline: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Conteúdo da vaga" description="Texto público exibido na página da vaga.">
        <MarkdownEditor value={draft.content} onChange={(v) => patch({ content: v })} mode={editorMode} onModeChange={setEditorMode} rows={14} />
      </Panel>

      {error && (
        <div role="alert" className="rounded-control border border-danger-border bg-danger-bg px-4 py-2.5 text-body text-danger-fg">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="primary" icon={done ? Check : undefined} loading={saving} disabled={done} onClick={submit}>
          {done ? "Vaga criada" : "Criar vaga"}
        </Button>
      </div>
    </div>
  );
}
