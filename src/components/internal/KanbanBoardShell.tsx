"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { SearchBar } from "@/components/internal/SearchBar";
import {
  KanbanColumn,
  KanbanSortableCard,
  KanbanCardOverlay,
  useKanbanSensors,
} from "@/components/internal/kanban-dnd";

export interface KanbanColumnDef {
  key: string;
  label: string;
  /** Classe Tailwind da bolinha (ex.: "bg-blue-400"). Opcional se usar dotColor. */
  dot?: string;
  /** Cor hex da bolinha (ex.: "#22c55e"), para etapas com cor configurável. */
  dotColor?: string;
  /** Tipo semântico da etapa (ex.: "TEST"). */
  kind?: string;
  /** Subtítulo exibido abaixo do nome (ex.: nome do teste vinculado). */
  subtitle?: string;
}

/** API entregue a cada card renderizado (ex.: pedir exclusão do item). */
export interface KanbanCardApi {
  requestDelete: (id: string) => void;
}

interface Props<T> {
  initialItems: T[];
  columns: KanbanColumnDef[];
  canManage: boolean;
  /** Extração de campos do item (genérico). */
  getId: (item: T) => string;
  getColumn: (item: T) => string;
  applyColumn: (item: T, columnKey: string) => T;
  /** Persiste a mudança de coluna; o shell cuida de otimismo, revert e toast. */
  onMove: (id: string, toColumn: string) => Promise<Response>;
  moveSuccess: (item: T, toLabel: string) => string;
  moveError?: string;
  emptyLabel: string;
  renderCard: (item: T, api: KanbanCardApi) => ReactNode;
  /** Classe extra aplicada a cada card (ex.: "group"). */
  cardClassName?: string;
  /** Quando informado, renderiza uma barra de busca acima das colunas. */
  filterFn?: (item: T, query: string) => boolean;
  searchPlaceholder?: string;
  /** Controles extras renderizados à direita da barra de pesquisa. */
  topControls?: ReactNode;
  // ── Exclusão opcional ──────────────────────────────────────────────────────
  onDelete?: (id: string) => Promise<Response>;
  deleteSuccess?: (item: T) => string;
  deleteError?: string;
  /** Se informado, pede confirmação (ConfirmModal) antes de excluir. */
  confirmDelete?: (item: T) => { title: string; message: string; confirmLabel: string };
  /**
   * Chamado antes do update otimista. Retorne false para abortar o move.
   * Usado para interceptar moves que exigem confirmação (ex: etapas de Admissão).
   */
  onBeforeMove?: (id: string, toColumn: string) => boolean;
  /**
   * Chamado quando o usuário reordena cards dentro de uma coluna.
   * Recebe a nova lista de IDs (coluna completa) e a chave da coluna.
   */
  onReorder?: (ids: string[], columnKey: string) => Promise<void>;
}

/**
 * Casco genérico de quadro Kanban com:
 * - Drag entre colunas (muda stage)
 * - Drag dentro da coluna (reordena com persistência via onReorder)
 * - Ordem padrão controlada pelo pai (initialItems já ordenados)
 */
export function KanbanBoardShell<T>({
  initialItems,
  columns,
  canManage,
  getId,
  getColumn,
  applyColumn,
  onMove,
  moveSuccess,
  moveError = "Erro ao mover.",
  emptyLabel,
  renderCard,
  cardClassName = "",
  filterFn,
  searchPlaceholder = "Pesquisar...",
  topControls,
  onDelete,
  deleteSuccess,
  deleteError = "Erro ao excluir.",
  confirmDelete,
  onBeforeMove,
  onReorder,
}: Props<T>) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  // Ordem customizada por coluna (sobrescreve a ordem do pai quando o usuário reordena)
  const [columnOrderOverrides, setColumnOrderOverrides] = useState<Record<string, string[]>>({});
  const { notify } = useToast();
  const sensors = useKanbanSensors();

  const items = useMemo(() => {
    const base =
      deletedIds.size > 0
        ? initialItems.filter((it) => !deletedIds.has(getId(it)))
        : initialItems;
    if (Object.keys(overrides).length === 0) return base;
    return base.map((it) => {
      const col = overrides[getId(it)];
      return col != null ? applyColumn(it, col) : it;
    });
  }, [initialItems, overrides, deletedIds, getId, applyColumn]);

  const visibleItems =
    filterFn && searchQuery.trim()
      ? items.filter((it) => filterFn(it, searchQuery.trim()))
      : items;

  /** Retorna os items de uma coluna respeitando a ordem customizada (se houver). */
  function getColumnItems(colKey: string): T[] {
    const colItems = visibleItems.filter((it) => getColumn(it) === colKey);
    const order = columnOrderOverrides[colKey];
    if (!order) return colItems;
    const idToItem = new Map(colItems.map((it) => [getId(it), it]));
    const ordered: T[] = [];
    for (const id of order) {
      const item = idToItem.get(id);
      if (item) ordered.push(item);
    }
    // Novos itens não presentes na ordem salva → vão ao final
    const inOrder = new Set(order);
    for (const it of colItems) {
      if (!inOrder.has(getId(it))) ordered.push(it);
    }
    return ordered;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const isColumnTarget = columns.some((c) => c.key === overId);

    if (isColumnTarget) {
      // Solto em cima da coluna → muda de etapa
      move(activeId, overId);
      return;
    }

    // Solto em cima de outro card
    const activeItem = items.find((it) => getId(it) === activeId);
    const overItem = items.find((it) => getId(it) === overId);
    if (!activeItem || !overItem) return;

    const activeCol = getColumn(activeItem);
    const overCol = getColumn(overItem);

    if (activeCol !== overCol) {
      // Cross-column: muda de etapa (insere no fim da coluna destino)
      move(activeId, overCol);
    } else {
      // Mesma coluna: reordena
      reorderWithin(activeId, overId, activeCol);
    }
  }

  async function move(id: string, toColumn: string) {
    const item = items.find((it) => getId(it) === id);
    if (!item || getColumn(item) === toColumn) return;
    if (onBeforeMove && !onBeforeMove(id, toColumn)) return;

    const prevOverride = overrides[id];
    setOverrides((o) => ({ ...o, [id]: toColumn }));
    const revert = () =>
      setOverrides((o) => {
        const next = { ...o };
        if (prevOverride === undefined) delete next[id];
        else next[id] = prevOverride;
        return next;
      });

    try {
      const res = await onMove(id, toColumn);
      if (!res.ok) {
        revert();
        const data = await res.json().catch(() => ({}));
        notify("error", typeof data.error === "string" ? data.error : moveError);
        return;
      }
      const label = columns.find((c) => c.key === toColumn)?.label ?? toColumn;
      notify("success", moveSuccess(item, label));
    } catch {
      revert();
      notify("error", "Erro de conexão. Tente novamente.");
    }
  }

  function reorderWithin(activeId: string, overId: string, columnKey: string) {
    if (!onReorder) return;
    const colItems = getColumnItems(columnKey);
    const ids = colItems.map((it) => getId(it));
    const fromIndex = ids.indexOf(activeId);
    const toIndex = ids.indexOf(overId);
    if (fromIndex === -1 || toIndex === -1) return;
    const newOrder = arrayMove(ids, fromIndex, toIndex);
    const prevOrder = ids;
    setColumnOrderOverrides((prev) => ({ ...prev, [columnKey]: newOrder }));
    void onReorder(newOrder, columnKey).catch(() => {
      setColumnOrderOverrides((prev) => ({ ...prev, [columnKey]: prevOrder }));
      notify("error", "Erro ao salvar a ordem. Tente novamente.");
    });
  }

  async function performDelete(id: string) {
    if (!onDelete) return;
    const item = items.find((it) => getId(it) === id);

    setDeletedIds((s) => new Set(s).add(id));
    const revert = () =>
      setDeletedIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });

    try {
      const res = await onDelete(id);
      if (!res.ok) {
        revert();
        const data = await res.json().catch(() => ({}));
        notify("error", typeof data.error === "string" ? data.error : deleteError);
        return;
      }
      if (item && deleteSuccess) notify("success", deleteSuccess(item));
    } catch {
      revert();
      notify("error", "Erro de conexão. Tente novamente.");
    }
  }

  const cardApi: KanbanCardApi = {
    requestDelete: (id) => {
      if (confirmDelete) setDeleteId(id);
      else performDelete(id);
    },
  };

  const deleting = deleteId ? items.find((it) => getId(it) === deleteId) : undefined;
  const confirmContent = deleting && confirmDelete ? confirmDelete(deleting) : null;

  return (
    <>
      {(filterFn || topControls) && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          {filterFn && (
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={searchPlaceholder}
              className="flex-1 min-w-[180px] max-w-xs"
            />
          )}
          {topControls && <div className="ml-auto flex items-center gap-2">{topControls}</div>}
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3.5 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colItems = getColumnItems(col.key);
            const colIds = colItems.map((it) => getId(it));
            return (
              <KanbanColumn key={col.key} id={col.key}>
                <div className="flex items-center gap-2 px-3.5 py-3 min-w-0">
                  <span className="text-[13px] font-semibold text-[#1A2213] leading-snug break-words flex-1 min-w-0">
                    {col.label}
                  </span>
                  <span className="text-[10px] font-bold text-[#55614A] bg-[#E8EEE1] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5 shrink-0 tabular-nums">
                    {colItems.length}
                  </span>
                </div>

                <SortableContext items={colIds} strategy={verticalListSortingStrategy}>
                  <div className="p-2.5 flex flex-col gap-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-300px)]">
                    {colItems.length === 0 && (
                      <p className="text-xs text-gray-500 text-center py-6">{emptyLabel}</p>
                    )}
                    {colItems.map((it) => (
                      <KanbanSortableCard
                        key={getId(it)}
                        id={getId(it)}
                        draggable={canManage}
                        className={cardClassName}
                      >
                        {renderCard(it, cardApi)}
                      </KanbanSortableCard>
                    ))}
                  </div>
                </SortableContext>
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeId
            ? (() => {
                const item = items.find((it) => getId(it) === activeId);
                return item ? (
                  <KanbanCardOverlay draggable={canManage} className={cardClassName}>
                    {renderCard(item, cardApi)}
                  </KanbanCardOverlay>
                ) : null;
              })()
            : null}
        </DragOverlay>
      </DndContext>

      {confirmDelete && (
        <ConfirmModal
          isOpen={deleteId !== null}
          title={confirmContent?.title ?? ""}
          message={confirmContent?.message ?? ""}
          confirmLabel={confirmContent?.confirmLabel ?? "Confirmar"}
          variant="danger"
          onConfirm={() => {
            if (deleteId) performDelete(deleteId);
            setDeleteId(null);
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </>
  );
}
