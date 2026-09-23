"use client";

import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "./dnd-modifiers";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortableHandleProps = HTMLAttributes<HTMLButtonElement> & {
  ref: (el: HTMLElement | null) => void;
};

interface Props<T> {
  items: T[];
  getId: (item: T) => string;
  /** Nome do item para leitores de tela ("Etapa Triagem"). */
  getLabel: (item: T) => string;
  onReorder: (next: T[]) => void;
  renderItem: (item: T, state: { handle: ReactNode; isDragging: boolean; index: number }) => ReactNode;
  disabled?: boolean;
  className?: string;
  /** Rótulo da lista para leitores de tela. */
  label: string;
}

/**
 * Lista vertical reordenável por arrastar e soltar (@dnd-kit/sortable).
 * A alça ⋮⋮ também funciona pelo teclado: Espaço/Enter pega o item, ↑ ↓ movem,
 * Espaço/Enter solta e Esc cancela — com anúncios em português para leitores de tela.
 */
export function SortableList<T>({ items, getId, getLabel, onReorder, renderItem, disabled, className, label }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = items.map(getId);
  const nameOf = (id: string | number) => {
    const item = items.find((i) => getId(i) === String(id));
    return item ? getLabel(item) : "item";
  };
  const posOf = (id: string | number) => ids.indexOf(String(id)) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${nameOf(active.id)} selecionado. Posição ${posOf(active.id)} de ${ids.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} movido para a posição ${posOf(over.id)} de ${ids.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} solto na posição ${posOf(over.id)} de ${ids.length}.` : `${nameOf(active.id)} solto.`,
    onDragCancel: ({ active }) => `Movimento cancelado. ${nameOf(active.id)} voltou à posição original.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para reordenar, pressione Espaço ou Enter para pegar o item, use as setas para cima e para baixo e pressione Espaço ou Enter para soltar. Esc cancela.",
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul aria-label={label} className={className}>
          {items.map((item, index) => (
            <SortableRow key={getId(item)} id={getId(item)} label={getLabel(item)} disabled={disabled}>
              {(handle, isDragging) => renderItem(item, { handle, isDragging, index })}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  label,
  disabled,
  children,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  children: (handle: ReactNode, isDragging: boolean) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reordenar ${label}`}
      title="Arraste para reordenar"
      disabled={disabled}
      className={cn(
        "flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-[#A3AD98] transition-colors",
        "hover:bg-wg-hover-light hover:text-wg-ink-muted active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
        "disabled:cursor-not-allowed disabled:opacity-40"
      )}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "rounded-card bg-white shadow-[0_12px_28px_rgba(26,34,19,.16)] ring-2 ring-wg-green/40")}
    >
      {children(handle, isDragging)}
    </li>
  );
}
