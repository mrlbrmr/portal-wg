"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { FlowStage } from "@/lib/recruitment/candidate-stage-flow";
import { cn } from "@/lib/utils";
import { DialogShell } from "./DialogShell";

interface Props {
  open: boolean;
  candidateName: string;
  currentStageName: string | null;
  targets: FlowStage[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (stageId: string) => void;
}

/** "Mover para outra etapa": escolha explícita de destino (fora da ordem linear). */
export function MoveStageDialog({ open, candidateName, currentStageName, targets, busy, onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (open) setSelected("");
  }, [open]);

  return (
    <DialogShell
      open={open}
      title="Mover para outra etapa"
      description={
        <>
          {candidateName}
          {currentStageName ? ` está em “${currentStageName}”.` : "."} Escolha o destino.
        </>
      }
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => selected && onConfirm(selected)} disabled={!selected} loading={busy}>
            Mover candidato
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="sr-only">Etapa de destino</legend>
        <div className="space-y-1">
          {targets.map((s) => (
            <label
              key={s.id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2 text-body transition-colors",
                selected === s.id
                  ? "border-wg-green bg-success-bg text-wg-ink"
                  : "border-transparent text-wg-ink-secondary hover:bg-wg-bg"
              )}
            >
              <input
                type="radio"
                name="move-stage"
                value={s.id}
                checked={selected === s.id}
                onChange={() => setSelected(s.id)}
                className="h-3.5 w-3.5 accent-[#4F6930]"
              />
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="flex-1">{s.name}</span>
              {s.hideFromBoard && <span className="text-meta text-wg-ink-muted">fora do Kanban</span>}
            </label>
          ))}
        </div>
      </fieldset>
    </DialogShell>
  );
}
