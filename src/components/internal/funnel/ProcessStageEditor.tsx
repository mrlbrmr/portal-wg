"use client";

// Editor de etapas de um processo (modelo ou vaga): lista ORDENADA e reordenável, com
// "Adicionar etapa" (do catálogo do funil) e "Nova etapa" (cria no catálogo). A etapa de
// entrada é obrigatória. Usado nos Modelos de processo e no processo de cada vaga.

import { useMemo, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { SortableList } from "@/components/internal/settings/SortableList";
import { settingsInputClass, settingsSelectClass } from "@/components/internal/settings/fields";
import { ENTRY_STAGE_ID, STAGE_KIND_LABELS, isStageKind } from "@/lib/selection-funnel/automations";
import { createStageForProcess } from "@/lib/selection-funnel/process-actions";

export interface EditorStage {
  id: string;
  name: string;
  color: string;
  kind: string;
}

interface Props {
  catalog: EditorStage[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Candidatos por etapa (só no processo da vaga) — avisa antes de remover. */
  counts?: Record<string, number>;
  disabled?: boolean;
  /** Permite criar etapa nova no catálogo (só ADMIN_RH; as ações já checam no servidor). */
  allowCreate?: boolean;
}

export function ProcessStageEditor({ catalog, value, onChange, counts, disabled, allowCreate = true }: Props) {
  const { notify } = useToast();
  const [created, setCreated] = useState<EditorStage[]>([]);
  const [pick, setPick] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, startCreate] = useTransition();

  const all = useMemo(() => [...catalog, ...created.filter((c) => !catalog.some((s) => s.id === c.id))], [catalog, created]);
  const byId = useMemo(() => new Map(all.map((s) => [s.id, s])), [all]);
  const items = value.map((id) => byId.get(id)).filter((s): s is EditorStage => Boolean(s));
  const available = all.filter((s) => !value.includes(s.id));

  function add(id: string) {
    if (!id || value.includes(id)) return;
    onChange([...value, id]);
    setPick("");
  }

  function create() {
    const name = newName.trim();
    if (!name) return;
    startCreate(async () => {
      const res = await createStageForProcess(name);
      if (!res.ok) {
        notify("error", res.error);
        return;
      }
      setCreated((prev) => [...prev, { ...res.stage, kind: "OPEN" }]);
      onChange([...value, res.stage.id]);
      setNewName("");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <SortableList
        items={items}
        getId={(s) => s.id}
        getLabel={(s) => `Etapa ${s.name}`}
        label="Etapas do processo, em ordem"
        disabled={disabled}
        onReorder={(next) => onChange(next.map((s) => s.id))}
        className="flex flex-col gap-1.5"
        renderItem={(stage, { handle, index }) => {
          const n = counts?.[stage.id] ?? 0;
          const locked = stage.id === ENTRY_STAGE_ID;
          return (
            <div className="flex items-center gap-2 rounded-control border border-wg-border-light bg-white px-2 py-1.5">
              {handle}
              <span className="w-5 shrink-0 text-center text-label tabular-nums text-wg-ink-muted">{index + 1}</span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: stage.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-body font-semibold text-wg-ink">{stage.name}</span>
              <span className="hidden shrink-0 text-label text-wg-ink-muted sm:inline">
                {isStageKind(stage.kind) ? STAGE_KIND_LABELS[stage.kind] : ""}
              </span>
              {n > 0 && (
                <span className="shrink-0 rounded-full bg-info-bg px-2 py-0.5 text-label font-semibold text-info-fg">
                  {n} {n === 1 ? "candidato" : "candidatos"}
                </span>
              )}
              {locked ? (
                <span className="shrink-0 rounded-full bg-neutral-bg px-2 py-0.5 text-label font-semibold text-neutral-fg" title="Toda nova candidatura começa nesta etapa.">
                  Entrada
                </span>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((id) => id !== stage.id))}
                  aria-label={`Remover ${stage.name} do processo`}
                  title="Remover do processo"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-wg-ink-muted hover:bg-wg-hover-light hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50 disabled:opacity-40"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          );
        }}
      />

      {items.length === 0 && <p className="text-meta text-wg-ink-muted">Nenhuma etapa. Adicione a etapa de entrada para começar.</p>}

      {!disabled && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex gap-2">
            <select
              aria-label="Adicionar etapa do funil"
              value={pick}
              onChange={(e) => add(e.target.value)}
              disabled={available.length === 0}
              className={settingsSelectClass}
            >
              <option value="">{available.length === 0 ? "Todas as etapas já estão no processo" : "Adicionar etapa do funil…"}</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {allowCreate && (
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    create();
                  }
                }}
                maxLength={120}
                placeholder="Nova etapa (ex.: Teste prático)"
                aria-label="Nome da nova etapa"
                className={settingsInputClass}
              />
              <Button variant="secondary" icon={Plus} loading={creating} disabled={!newName.trim()} onClick={create}>
                Criar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
