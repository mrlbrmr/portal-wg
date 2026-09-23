"use client";

import { useEffect, useState, useTransition } from "react";
import { Info, Loader2, Users } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { settingsSelectClass } from "@/components/internal/settings/fields";
import {
  getStageUsage,
  removeStage,
  setStageActive,
  type StageUsage,
} from "@/lib/selection-funnel/config-actions";

interface StageLite {
  id: string;
  name: string;
  active: boolean;
}

interface Props {
  target: { stage: StageLite; mode: "delete" | "deactivate" } | null;
  stages: StageLite[];
  onClose: () => void;
  onDone: () => void;
}

const KEEP = "__keep__";

/**
 * Excluir ou desativar uma etapa do funil sem perder candidatos nem histórico.
 * Antes de confirmar, mostra quantos candidatos estão na etapa e para onde irão.
 */
export function StageRemovalDialog({ target, stages, onClose, onDone }: Props) {
  const { notify } = useToast();
  const [usage, setUsage] = useState<StageUsage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const stage = target?.stage ?? null;
  const mode = target?.mode ?? "delete";
  const destinations = stages.filter((s) => s.active && s.id !== stage?.id);

  useEffect(() => {
    if (!stage) return;
    setUsage(null);
    setLoadError(null);
    setMoveTo(mode === "deactivate" ? destinations[0]?.id ?? KEEP : destinations[0]?.id ?? "");
    let alive = true;
    getStageUsage(stage.id).then((res) => {
      if (!alive) return;
      if (res.ok) setUsage(res.usage);
      else setLoadError(res.error);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.id, mode]);

  if (!stage) return null;

  const current = usage?.current ?? 0;
  const willDeactivate = mode === "deactivate" || (usage?.history ?? 0) > 0 || current > 0;
  const needsDestination = mode === "delete" && current > 0;
  const canConfirm = !!usage && (!needsDestination || !!moveTo) && (current === 0 || destinations.length > 0 || mode === "deactivate");

  function confirm() {
    if (!stage) return;
    startTransition(async () => {
      if (mode === "deactivate") {
        const res = await setStageActive(stage.id, false, { moveTo: moveTo && moveTo !== KEEP ? moveTo : null });
        if (!res.ok) return notify("error", res.error);
        notify("success", `Etapa "${stage.name}" desativada.`);
        return onDone();
      }
      const res = await removeStage(stage.id, { moveTo: current > 0 ? moveTo : null });
      if (!res.ok) return notify("error", res.error);
      const movedMsg = res.moved ? ` ${res.moved} candidato(s) movido(s).` : "";
      notify(
        "success",
        res.outcome === "deleted"
          ? `Etapa "${stage.name}" excluída.${movedMsg}`
          : `Etapa "${stage.name}" desativada para preservar o histórico.${movedMsg}`
      );
      onDone();
    });
  }

  const title = mode === "deactivate" ? `Desativar a etapa "${stage.name}"?` : `Excluir a etapa "${stage.name}"?`;
  const confirmLabel =
    mode === "deactivate"
      ? current > 0 && moveTo !== KEEP
        ? "Mover e desativar"
        : "Desativar etapa"
      : willDeactivate
        ? current > 0
          ? "Mover e remover etapa"
          : "Desativar etapa"
        : "Excluir etapa";

  return (
    <Dialog
      open
      alert
      onClose={onClose}
      busy={pending}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} loading={pending} disabled={!canConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {!usage && !loadError ? (
        <p className="flex items-center gap-2 text-body text-wg-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verificando o uso da etapa…
        </p>
      ) : loadError ? (
        <p role="alert" className="text-body text-danger-fg">
          {loadError}
        </p>
      ) : (
        <div className="space-y-4 text-body text-wg-ink-secondary">
          {current > 0 ? (
            <div className="flex items-start gap-2 rounded-control border border-warning-border bg-warning-bg px-3 py-2.5 text-warning-fg">
              <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                <strong>
                  {current} {current === 1 ? "candidato está" : "candidatos estão"}
                </strong>{" "}
                nesta etapa agora. Nenhum candidato é excluído.
              </p>
            </div>
          ) : (
            <p>Nenhum candidato está nesta etapa agora.</p>
          )}

          {current > 0 && (
            <div>
              <label htmlFor="stage-move-to" className="mb-1.5 block text-label font-semibold text-wg-ink-secondary">
                {mode === "deactivate" ? "O que fazer com esses candidatos?" : "Mover os candidatos para"}
              </label>
              {destinations.length === 0 && mode === "delete" ? (
                <p className="text-meta text-danger-fg">Não há outra etapa ativa para receber os candidatos.</p>
              ) : (
                <select
                  id="stage-move-to"
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                  className={settingsSelectClass}
                >
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      Mover para “{d.name}”
                    </option>
                  ))}
                  {mode === "deactivate" && (
                    <option value={KEEP}>Não mover (ficam fora do quadro até a etapa ser reativada)</option>
                  )}
                </select>
              )}
              <p className="mt-1 text-label font-normal text-wg-ink-muted">
                A mudança de etapa fica registrada no histórico de cada candidato.
              </p>
            </div>
          )}

          {mode === "delete" && willDeactivate && (
            <p className="flex items-start gap-2 text-meta text-wg-ink-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Esta etapa já faz parte do histórico de candidatos. Para não perder esse histórico, ela será{" "}
                <strong className="text-wg-ink-secondary">desativada</strong> em vez de excluída: sai do funil de todas
                as vagas, mas continua nos registros e pode ser reativada.
              </span>
            </p>
          )}
          {mode === "delete" && !willDeactivate && (
            <p>A etapa nunca foi usada e será excluída definitivamente.</p>
          )}
          {mode === "deactivate" && (
            <p className="text-meta text-wg-ink-muted">
              A etapa sai do funil de todas as vagas e pode ser reativada a qualquer momento.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
