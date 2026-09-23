"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import {
  KanbanBoardShell,
  type KanbanCardApi,
  type KanbanColumnDef,
} from "@/components/internal/KanbanBoardShell";
import { withStage, type PipelineCandidate } from "./types";

interface Props {
  items: PipelineCandidate[];
  columns: KanbanColumnDef[];
  canManage: boolean;
  /** "external" quando há uma ordenação ativa na toolbar (desliga reordenar arrastando). */
  orderMode: "manual" | "external";
  onBeforeMove: (id: string, toStageId: string) => boolean;
  onMoved: () => void;
  renderCard: (c: PipelineCandidate, api: KanbanCardApi) => ReactNode;
}

const getId = (a: PipelineCandidate) => a.id;
const getColumn = (a: PipelineCandidate) => a.stageId;
const applyColumn = withStage;

/**
 * Kanban de candidatos: colunas estreitas (272px) quase transparentes sobre o fundo claro,
 * cards brancos, cabeçalho fixo acima da rolagem de cada coluna e navegação horizontal
 * com setas + sombra de borda indicando que há mais etapas. O arraste (mudança de etapa,
 * reordenação, gate de admissão) é o mesmo do KanbanBoardShell.
 */
export function CandidateKanban({ items, columns, canManage, orderMode, onBeforeMove, onMoved, renderCard }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const { notify } = useToast();

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure, columns.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(284, el.clientWidth * 0.75), behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Sombras de borda: indicam que há etapas escondidas daquele lado. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-slate-50 to-transparent transition-opacity",
          edges.left ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-slate-50 to-transparent transition-opacity",
          edges.right ? "opacity-100" : "opacity-0"
        )}
      />
      {edges.left && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Ver etapas anteriores"
          title="Etapas anteriores"
          className="absolute left-1 top-24 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-wg-border-light bg-white text-wg-ink-secondary shadow-[0_2px_8px_rgba(26,34,19,.12)] transition-colors hover:bg-wg-bg hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
      )}
      {edges.right && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Ver próximas etapas"
          title="Próximas etapas"
          className="absolute right-1 top-24 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-wg-border-light bg-white text-wg-ink-secondary shadow-[0_2px_8px_rgba(26,34,19,.12)] transition-colors hover:bg-wg-bg hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      )}

      <KanbanBoardShell<PipelineCandidate>
        initialItems={items}
        columns={columns}
        canManage={canManage}
        cardVariant="surface"
        orderMode={orderMode}
        scrollerRef={scrollerRef}
        boardClassName="flex items-start gap-3 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin]"
        columnClassName="flex w-[272px] shrink-0 flex-col rounded-card bg-[#EEF2E8]/50 transition-colors data-[over]:bg-wg-green/10 data-[over]:ring-2 data-[over]:ring-wg-green/30"
        columnBodyClassName="flex min-h-[132px] max-h-[max(320px,calc(100vh-400px))] flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-2 [scrollbar-width:thin]"
        getId={getId}
        getColumn={getColumn}
        applyColumn={applyColumn}
        onMove={async (id, stageId) => {
          const res = await fetch(`/api/applications/${id}`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stageId }),
          });
          // Automação da etapa (ver src/lib/selection-funnel/automations.ts).
          if (res.ok) {
            res
              .clone()
              .json()
              .then((b: { automation?: { testLinkCreated?: boolean } }) => {
                if (b.automation?.testLinkCreated) {
                  notify("info", "Link do teste gerado automaticamente — disponível na ficha do candidato.");
                }
              })
              .catch(() => {});
          }
          return res;
        }}
        onMoved={onMoved}
        onReorder={async (ids) => {
          const res = await fetch("/api/applications/reorder", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orders: ids.map((id, index) => ({ id, sortOrder: index })) }),
          });
          if (!res.ok) throw new Error("Erro ao salvar ordem");
        }}
        onBeforeMove={onBeforeMove}
        moveSuccess={(a, label) => `${a.fullName} movido para ${label}.`}
        moveError="Erro ao mover candidatura."
        emptyLabel="Nenhum candidato nesta etapa"
        renderColumnHeader={(col, count) => <StageHeader col={col} count={count} />}
        renderEmpty={() => <EmptyStage canDrop={canManage} />}
        renderCard={renderCard}
      />
    </div>
  );
}

function StageHeader({ col, count }: { col: KanbanColumnDef; count: number }) {
  return (
    <div className="px-3 pb-2 pt-2.5">
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: col.dotColor ?? "#9AA68A" }} />
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-wg-ink" title={col.label}>
          {col.label}
        </h3>
        <span
          className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold tabular-nums text-wg-ink-secondary shadow-[inset_0_0_0_1px_#E1E6DA]"
          aria-label={`${count} ${count === 1 ? "candidato" : "candidatos"}`}
        >
          {count}
        </span>
      </div>
      {col.subtitle && (
        <p className="mt-0.5 truncate pl-4 text-[11.5px] text-wg-ink-muted" title={col.subtitle}>
          {col.subtitle}
        </p>
      )}
      {/*
        Espaço reservado para métricas da etapa (ex.: "Tempo médio: 1,8 dia"). O histórico
        de etapas já existe (application_stage_history); a métrica deve nascer em
        src/lib/recruitment/sla.ts e ser exibida aqui — nada é mostrado até lá.
      */}
    </div>
  );
}

function EmptyStage({ canDrop }: { canDrop: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-[#DCE3D2] px-3 py-6 text-center">
      <Inbox className="mb-1.5 h-4 w-4 text-wg-ink-muted/70" aria-hidden />
      <p className="text-[12px] font-medium text-wg-ink-secondary">Nenhum candidato nesta etapa</p>
      {canDrop && <p className="mt-0.5 text-[11.5px] text-wg-ink-muted">Arraste um candidato para cá.</p>}
    </div>
  );
}
