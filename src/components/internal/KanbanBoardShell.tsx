"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { FlaskConical } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { SearchBar } from "@/components/internal/SearchBar";
import {
  KanbanColumn,
  KanbanCard,
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
  /** Quando informado, renderiza uma barra de busca acima das colunas que filtra cards na hora de exibir (sem redefinir o estado de drag-drop). */
  filterFn?: (item: T, query: string) => boolean;
  searchPlaceholder?: string;
  // ── Exclusão opcional (usada só onde faz sentido, ex.: candidatos) ──────
  onDelete?: (id: string) => Promise<Response>;
  deleteSuccess?: (item: T) => string;
  deleteError?: string;
  /** Se informado, pede confirmação (ConfirmModal) antes de excluir. */
  confirmDelete?: (item: T) => { title: string; message: string; confirmLabel: string };
}

/**
 * Casco genérico de quadro Kanban: colunas droppable, header (dot + rótulo +
 * contador), estado vazio, DndContext e o padrão otimista de mover (PATCH +
 * revert em erro + toast). Opcionalmente trata exclusão de card com
 * confirmação. Os dois quadros do app (vagas e candidatos) são só configuração
 * + renderCard sobre este casco. Ver [[kanban-dnd]] para as primitivas.
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
  onDelete,
  deleteSuccess,
  deleteError = "Erro ao excluir.",
  confirmDelete,
}: Props<T>) {
  // O quadro reflete `initialItems` (que já vem ordenado/filtrado pelo pai) e
  // aplica por cima os movimentos/exclusões otimistas feitos por drag-and-drop.
  // Assim, mudar a ordenação/filtro no pai atualiza o Kanban na hora, sem
  // perder um card que o usuário acabou de arrastar. (Antes o estado era
  // inicializado uma vez de `initialItems` e nunca ressincronizava — por isso
  // o "Ordenar" não surtia efeito na visão Kanban.)
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over) move(String(active.id), String(over.id));
  }

  async function move(id: string, toColumn: string) {
    const item = items.find((it) => getId(it) === id);
    if (!item || getColumn(item) === toColumn) return;

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

  const visibleItems =
    filterFn && searchQuery.trim()
      ? items.filter((it) => filterFn(it, searchQuery.trim()))
      : items;

  return (
    <>
      {filterFn && (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={searchPlaceholder}
          className="mb-4 max-w-xs"
        />
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3.5 overflow-x-auto pb-4">
          {columns.map((col) => {
            const cards = visibleItems.filter((it) => getColumn(it) === col.key);
            return (
              <KanbanColumn key={col.key} id={col.key}>
                <div className={col.kind === "TEST" ? "rounded-t-2xl bg-[#F0EAFA]" : ""}>
                  <div className="flex items-center gap-2 px-3.5 py-3 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ring-1 ring-black/10 ${col.dotColor ? "" : col.dot ?? ""}`}
                      style={col.dotColor ? { backgroundColor: col.dotColor } : undefined}
                    />
                    <span className="text-[13.5px] font-bold text-[#1A2213] truncate min-w-0">{col.label}</span>
                    {col.kind === "TEST" && (
                      <FlaskConical className="w-3.5 h-3.5 text-purple-500 shrink-0" aria-label="Etapa de teste" />
                    )}
                    <span className="text-[11px] font-bold text-white bg-[#1A2213] rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shrink-0 ml-auto">
                      {cards.length}
                    </span>
                  </div>
                  {col.kind === "TEST" && col.subtitle && (
                    <p className="px-4 pb-2 text-[11px] text-purple-600 truncate">{col.subtitle}</p>
                  )}
                </div>

                <div className="p-2.5 flex flex-col gap-2 min-h-[120px]">
                  {cards.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-6">{emptyLabel}</p>
                  )}

                  {cards.map((it) => (
                    <KanbanCard
                      key={getId(it)}
                      id={getId(it)}
                      draggable={canManage}
                      className={cardClassName}
                    >
                      {renderCard(it, cardApi)}
                    </KanbanCard>
                  ))}
                </div>
              </KanbanColumn>
            );
          })}
        </div>
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
