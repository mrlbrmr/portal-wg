"use client";

// Processo seletivo da vaga: escolher um modelo, ajustar só esta vaga (adicionar, remover e
// reordenar etapas) ou voltar a seguir o modelo padrão. Etapa que sai do processo e ainda
// tem candidatos exige um destino para eles (ninguém fica "órfão").

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { settingsSelectClass } from "@/components/internal/settings/fields";
import { ENTRY_STAGE_ID } from "@/lib/selection-funnel/automations";
import { saveJobProcess } from "@/lib/selection-funnel/process-actions";
import { removedWithCandidates, sameStageList, type RemovedStage } from "@/lib/selection-funnel/process-templates";
import { ProcessStageEditor, type EditorStage } from "./ProcessStageEditor";

export interface ProcessTemplateOption {
  id: string;
  name: string;
  isDefault: boolean;
  stageIds: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  jobId: string;
  catalog: EditorStage[];
  /** Etapas efetivas da vaga agora, na ordem dela. */
  currentStageIds: string[];
  /** A vaga tem ajuste próprio (não segue o modelo padrão). */
  isCustom: boolean;
  /** Modelo de origem da vaga (procedência). */
  templateId: string | null;
  templates: ProcessTemplateOption[];
  /** Candidatos da vaga por etapa. */
  counts: Record<string, number>;
}

export function JobProcessDialog({ open, onClose, ...rest }: Props) {
  // Remonta ao abrir: o rascunho sempre parte do que está salvo.
  return open ? <Inner key="open" onClose={onClose} {...rest} /> : null;
}

function Inner({ onClose, jobId, catalog, currentStageIds, isCustom, templateId, templates, counts }: Omit<Props, "open">) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [stageIds, setStageIds] = useState<string[]>(currentStageIds);
  const [tplId, setTplId] = useState<string | null>(isCustom ? templateId : null);
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [resetRemoved, setResetRemoved] = useState<RemovedStage[] | null>(null);

  const defaultTemplate = templates.find((t) => t.isDefault) ?? null;
  const tpl = templates.find((t) => t.id === tplId) ?? null;
  const names = useMemo(() => new Map(catalog.map((s) => [s.id, s.name])), [catalog]);

  const clientRemoved = useMemo(
    () => removedWithCandidates(currentStageIds, stageIds, counts, catalog),
    [currentStageIds, stageIds, counts, catalog]
  );
  const removed = resetRemoved ?? clientRemoved;
  const destinations = resetRemoved ? defaultTemplate?.stageIds ?? [] : stageIds;

  const dirty = !sameStageList(stageIds, currentStageIds);
  const adjusted = tpl ? !sameStageList(stageIds, tpl.stageIds) : false;

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    setResetRemoved(null);
    if (!t) {
      setTplId(null);
      return;
    }
    setTplId(t.id);
    setStageIds(t.stageIds);
    setMoves({});
  }

  function run(ids: string[], template: string | null, isReset: boolean) {
    const resolved: Record<string, string> = {};
    for (const r of removed) resolved[r.stageId] = moves[r.stageId] ?? ENTRY_STAGE_ID;
    startTransition(async () => {
      const res = await saveJobProcess(jobId, { stageIds: ids, templateId: template, moves: resolved });
      if (!res.ok) {
        if (res.needsMoves && isReset) setResetRemoved(res.needsMoves);
        notify("error", res.error);
        return;
      }
      notify(
        "success",
        isReset
          ? "A vaga voltou a seguir o modelo padrão."
          : `Processo da vaga salvo${res.moved ? ` — ${res.moved} candidato(s) movido(s)` : ""}.`
      );
      onClose();
      router.refresh();
    });
  }

  const status = !isCustom
    ? `Segue o modelo padrão${defaultTemplate ? ` (${defaultTemplate.name})` : ""}.`
    : templateId && templates.find((t) => t.id === templateId)
      ? sameStageList(currentStageIds, templates.find((t) => t.id === templateId)!.stageIds)
        ? `Modelo: ${templates.find((t) => t.id === templateId)!.name}.`
        : `Ajustado a partir do modelo ${templates.find((t) => t.id === templateId)!.name}.`
      : "Processo montado só para esta vaga.";

  return (
    <Dialog
      open
      onClose={onClose}
      busy={pending}
      size="lg"
      title="Processo seletivo da vaga"
      description={status}
      footer={
        <>
          {isCustom && (
            <Button
              variant="tertiary"
              disabled={pending}
              onClick={() => run([], null, true)}
              className="mr-auto"
            >
              Seguir modelo padrão
            </Button>
          )}
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={stageIds.length < 2 || (!dirty && tplId === (isCustom ? templateId : null))}
            onClick={() => run(stageIds, tplId, false)}
          >
            Salvar processo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {templates.length > 0 && (
          <div>
            <label htmlFor="job-process-template" className="mb-1.5 block text-label font-semibold text-wg-ink-secondary">
              Modelo de processo
            </label>
            <select
              id="job-process-template"
              value={tplId ?? ""}
              onChange={(e) => applyTemplate(e.target.value)}
              className={settingsSelectClass}
              disabled={pending}
            >
              <option value="">Montar só para esta vaga</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? " (padrão)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-label text-wg-ink-muted">
              {adjusted
                ? "Esta vaga está ajustada em relação ao modelo — o modelo em si não muda."
                : "Escolher um modelo copia as etapas para a vaga. Depois você pode ajustar só aqui."}
            </p>
          </div>
        )}

        <ProcessStageEditor
          catalog={catalog}
          value={stageIds}
          onChange={(next) => {
            setStageIds(next);
            setResetRemoved(null);
          }}
          counts={counts}
          disabled={pending}
        />

        {removed.length > 0 && (
          <div className="rounded-card border border-warning-border bg-warning-bg p-3" role="group" aria-label="Mover candidatos">
            <p className="mb-2 flex items-start gap-2 text-body font-semibold text-warning-fg">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Algumas etapas têm candidatos. Escolha para onde eles vão.
            </p>
            <ul className="flex flex-col gap-2">
              {removed.map((r) => (
                <li key={r.stageId} className="grid items-center gap-2 sm:grid-cols-2">
                  <span className="text-body text-wg-ink">
                    <strong>{r.name}</strong> — {r.candidates} {r.candidates === 1 ? "candidato" : "candidatos"}
                  </span>
                  <select
                    aria-label={`Mover candidatos de ${r.name} para`}
                    value={moves[r.stageId] ?? ENTRY_STAGE_ID}
                    onChange={(e) => setMoves((m) => ({ ...m, [r.stageId]: e.target.value }))}
                    className={settingsSelectClass}
                    disabled={pending}
                  >
                    {destinations.map((id) => (
                      <option key={id} value={id}>
                        {names.get(id) ?? id}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
