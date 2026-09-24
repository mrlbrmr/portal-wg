"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import { admissionProgress } from "@/lib/admissao/workspace";
import { useAdmissionWorkspace } from "./context";

/**
 * Progresso = etapas configuradas em Admissões → Configurações (a mesma jornada do Kanban).
 * "Avançar" usa o endpoint de etapa do Kanban (registra no histórico).
 */
export function AdmissionProgress() {
  const { data, options, canManage, isDirty } = useAdmissionWorkspace();
  const router = useRouter();
  const { notify } = useToast();
  const [moving, setMoving] = useState(false);
  const progress = useMemo(() => admissionProgress(options.stages, data.record.stageId), [options.stages, data.record.stageId]);

  if (progress.total === 0) {
    return (
      <Panel title="Progresso da admissão">
        <p className="text-body text-wg-ink-muted">Nenhuma etapa configurada. Cadastre as etapas em Admissões → Configurações.</p>
      </Panel>
    );
  }

  async function advance() {
    if (!progress.next) return;
    setMoving(true);
    try {
      const res = await fetch(`/api/admissoes/${data.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: progress.next.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notify("error", body.error ?? "Não foi possível mudar a etapa.");
        return;
      }
      notify("success", `Etapa alterada para “${progress.next.name}”.`);
      router.refresh();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setMoving(false);
    }
  }

  const outsideJourney = data.record.stageId && progress.currentIndex < 0;

  return (
    <Panel
      title="Progresso da admissão"
      meta={progress.isComplete ? "Concluída" : `${progress.completed} de ${progress.total} etapas concluídas`}
      action={
        canManage && progress.next ? (
          <Button
            size="sm"
            variant="secondary"
            icon={ArrowRight}
            loading={moving}
            disabled={isDirty}
            title={isDirty ? "Salve ou descarte as alterações antes de mudar a etapa" : undefined}
            onClick={advance}
          >
            {progress.currentIndex < 0 ? `Iniciar em “${progress.next.name}”` : `Avançar para “${progress.next.name}”`}
          </Button>
        ) : null
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={progress.percent} label="Progresso da admissão" tone={progress.isComplete ? "success" : "brand"} className="flex-1" />
        <span className="text-meta font-semibold tabular-nums text-wg-ink">{progress.percent}%</span>
      </div>
      {outsideJourney && (
        <p className="mb-3 text-meta text-warning-fg">
          A etapa atual ({data.saved.stageName ?? "removida"}) não está mais ativa na jornada configurada.
        </p>
      )}
      <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2" aria-label="Etapas da admissão">
        {progress.steps.map((s, i) => (
          <li
            key={s.id}
            aria-current={s.state === "current" ? "step" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-control px-2 py-1.5 text-body",
              s.state === "current" && "bg-wg-sidebar font-semibold text-wg-ink",
              s.state === "done" && "text-wg-ink-secondary",
              s.state === "todo" && "text-wg-ink-muted"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold tabular-nums",
                s.state === "done" && "border-wg-green-dark bg-wg-green-dark text-white",
                s.state === "current" && "border-wg-green-dark bg-white text-wg-green-dark ring-2 ring-wg-green/30",
                s.state === "todo" && "border-wg-border-light bg-white"
              )}
            >
              {s.state === "done" ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="min-w-0 truncate" title={s.name}>
              {s.name}
            </span>
            <span className="sr-only">{s.state === "done" ? "(concluída)" : s.state === "current" ? "(etapa atual)" : "(pendente)"}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
