"use client";

// Configurações › Modelos de processo: modelos reutilizáveis de funil (ex.: Operacional,
// Administrativo, Liderança). O modelo é COPIADO para a vaga: editar ou arquivar um modelo
// nunca altera vagas já configuradas.

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, KanbanSquare, MoreHorizontal, Pencil, Plus, Star } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { SettingsField, settingsInputClass } from "@/components/internal/settings/fields";
import {
  createProcessTemplate,
  duplicateProcessTemplate,
  setDefaultProcessTemplate,
  setProcessTemplateActive,
  updateProcessTemplate,
} from "@/lib/selection-funnel/process-actions";
import { ENTRY_STAGE_ID } from "@/lib/selection-funnel/automations";
import { ProcessStageEditor, type EditorStage } from "./ProcessStageEditor";

export interface ProcessTemplateRow {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  active: boolean;
  stageIds: string[];
  /** Vagas que partiram deste modelo. */
  jobs: number;
}

interface Props {
  templates: ProcessTemplateRow[];
  catalog: EditorStage[];
}

export function ProcessTemplatesManager({ templates, catalog }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<ProcessTemplateRow | "new" | null>(null);
  const byId = new Map(catalog.map((s) => [s.id, s]));

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) return notify("error", res.error ?? "Não foi possível concluir.");
      notify("success", success);
      router.refresh();
    });
  }

  function menu(t: ProcessTemplateRow): DropdownMenuItem[] {
    return [
      { label: "Editar", icon: Pencil, onSelect: () => setEditing(t) },
      { label: "Duplicar", icon: Copy, onSelect: () => run(() => duplicateProcessTemplate(t.id), "Modelo duplicado.") },
      ...(t.active && !t.isDefault
        ? [{ label: "Definir como padrão", icon: Star, onSelect: () => run(() => setDefaultProcessTemplate(t.id), `“${t.name}” é o novo modelo padrão.`) }]
        : []),
      t.active
        ? { label: "Arquivar", icon: Archive, onSelect: () => run(() => setProcessTemplateActive(t.id, false), "Modelo arquivado. Vagas já criadas não mudam.") }
        : { label: "Reativar", icon: ArchiveRestore, onSelect: () => run(() => setProcessTemplateActive(t.id, true), "Modelo reativado.") },
    ];
  }

  return (
    <section aria-label="Modelos de processo" className="rounded-card border border-wg-border-light bg-white">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <p className="text-meta text-wg-ink-muted">
          O <strong>modelo padrão</strong> vale para vagas sem ajuste. Etapas, cores, testes e automações vêm do{" "}
          <a href="/configuracoes/funil" className="font-semibold text-wg-green-dark hover:underline">
            Funil de seleção
          </a>
          .
        </p>
        <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
          Novo modelo
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState icon={KanbanSquare} title="Nenhum modelo de processo" description="Crie o primeiro modelo para reutilizar o funil nas vagas." className="border-t border-wg-border-lighter" />
      ) : (
        <ul className="divide-y divide-wg-border-lighter border-t border-wg-border-lighter">
          {templates.map((t) => (
            <li key={t.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    className={`rounded-sm text-left text-body font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50 ${t.active ? "text-wg-ink hover:text-wg-green-dark" : "text-wg-ink-muted"}`}
                  >
                    {t.name}
                  </button>
                  {t.isDefault && <StatusBadge tone="success">Padrão</StatusBadge>}
                  {!t.active && <StatusBadge tone="neutral">Arquivado</StatusBadge>}
                  <span className="text-label text-wg-ink-muted">
                    {t.stageIds.length} etapas · {t.jobs} {t.jobs === 1 ? "vaga" : "vagas"}
                  </span>
                </div>
                {t.description && <p className="mt-0.5 text-meta text-wg-ink-secondary">{t.description}</p>}
                <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-label text-wg-ink-secondary" aria-label="Etapas em ordem">
                  {t.stageIds.map((id, i) => {
                    const s = byId.get(id);
                    if (!s) return null;
                    return (
                      <li key={id} className="inline-flex items-center gap-1">
                        {i > 0 && <span aria-hidden className="text-wg-ink-muted">›</span>}
                        <span className="inline-flex items-center gap-1 rounded-full bg-wg-bg px-2 py-0.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                          {s.name}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <DropdownMenu
                trigger={<MoreHorizontal aria-hidden />}
                ariaLabel={`Ações do modelo ${t.name}`}
                triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                items={menu(t)}
                align="right"
              />
            </li>
          ))}
        </ul>
      )}

      <EditorDialog
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        template={editing === "new" ? null : editing}
        open={editing !== null}
        catalog={catalog}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </section>
  );
}

function EditorDialog({
  template,
  open,
  catalog,
  onClose,
  onSaved,
}: {
  template: ProcessTemplateRow | null;
  open: boolean;
  catalog: EditorStage[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const id = useId();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [stageIds, setStageIds] = useState<string[]>(template?.stageIds ?? [ENTRY_STAGE_ID]);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!name.trim()) return setError("Informe o nome do modelo.");
    setError(null);
    startTransition(async () => {
      const input = { name, description, stageIds };
      const res = template ? await updateProcessTemplate(template.id, input) : await createProcessTemplate(input);
      if (!res.ok) return setError(res.error);
      notify("success", template ? "Modelo atualizado. Vagas já configuradas não mudam." : "Modelo criado.");
      onSaved();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={pending}
      size="lg"
      title={template ? "Editar modelo de processo" : "Novo modelo de processo"}
      description={template ? "Alterações valem para as próximas vagas. Vagas já configuradas não mudam." : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" loading={pending} onClick={save}>
            {template ? "Salvar modelo" : "Criar modelo"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SettingsField id={`${id}-name`} label="Nome do modelo" required>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Ex.: Operacional"
            className={settingsInputClass}
          />
        </SettingsField>
        <SettingsField id={`${id}-desc`} label="Descrição" hint="Quando usar este modelo (opcional).">
          <input
            id={`${id}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={400}
            className={settingsInputClass}
          />
        </SettingsField>
        <div>
          <p className="mb-1.5 text-label font-semibold text-wg-ink-secondary">Etapas, em ordem</p>
          <ProcessStageEditor catalog={catalog} value={stageIds} onChange={setStageIds} disabled={pending} />
        </div>
        {error && (
          <p role="alert" className="text-meta text-danger-fg">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
