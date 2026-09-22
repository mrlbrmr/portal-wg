import {
  KeyboardCode,
  type DroppableContainer,
  type DroppableContainers,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * Arraste por teclado nos quadros Kanban.
 *
 * O coordinateGetter padrão do KeyboardSensor anda 25px por seta; num quadro com
 * rolagem horizontal isso só rola o contêiner e o card nunca chega à coluna vizinha.
 * Aqui: ← → pulam para o centro da coluna vizinha (rolando-a para a vista) e
 * ↑ ↓ andam entre os cards da coluna atual via `sortableKeyboardCoordinates`.
 */

/** Marca (em `data.type`) dos droppables que são colunas, e não cards. */
export const KANBAN_COLUMN_TYPE = "kanban-column";

export interface ColumnBox {
  id: UniqueIdentifier;
  left: number;
  right: number;
}

/**
 * Coluna vizinha, na direção pedida, da coluna sob o ponto `x`.
 * Retorna null na borda do quadro (não há para onde ir).
 */
export function findNeighborColumn<T extends ColumnBox>(
  columns: T[],
  x: number,
  direction: "left" | "right"
): T | null {
  const sorted = [...columns].sort((a, b) => a.left - b.left);
  const current = sorted.findIndex((c) => x >= c.left && x <= c.right);
  if (current !== -1) {
    return sorted[current + (direction === "right" ? 1 : -1)] ?? null;
  }
  // Ponto no vão entre colunas: a primeira coluna inteira do lado pedido.
  return direction === "right"
    ? (sorted.find((c) => c.left > x) ?? null)
    : (sorted.reverse().find((c) => c.right < x) ?? null);
}

function isColumn(entry: DroppableContainer) {
  return entry.data.current?.type === KANBAN_COLUMN_TYPE;
}

/** Rola na horizontal o primeiro ancestral rolável até a coluna ficar inteira na vista. */
function scrollColumnIntoView(node: HTMLElement) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const { overflowX } = getComputedStyle(el);
    if ((overflowX !== "auto" && overflowX !== "scroll") || el.scrollWidth <= el.clientWidth) {
      continue;
    }
    const box = el.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    const delta =
      rect.left < box.left ? rect.left - box.left : rect.right > box.right ? rect.right - box.right : 0;
    // Instantâneo: as coordenadas devolvidas abaixo são lidas logo depois da rolagem.
    if (delta) el.scrollBy({ left: delta, behavior: "instant" });
    return;
  }
}

export const kanbanKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { collisionRect, droppableRects, droppableContainers } = args.context;

  switch (event.code) {
    case KeyboardCode.Left:
    case KeyboardCode.Right: {
      // Sem isso a seta chega ao navegador e rola o contêiner do quadro.
      event.preventDefault();
      if (!collisionRect) return;

      const columns = droppableContainers.getEnabled().flatMap((entry) => {
        const rect = isColumn(entry) ? droppableRects.get(entry.id) : undefined;
        return rect ? [{ id: entry.id, left: rect.left, right: rect.right, node: entry.node.current }] : [];
      });
      const target = findNeighborColumn(
        columns,
        collisionRect.left + collisionRect.width / 2,
        event.code === KeyboardCode.Right ? "right" : "left"
      );
      if (!target) return;

      if (target.node) scrollColumnIntoView(target.node);
      // Os rects do dnd-kit descontam a rolagem na leitura: já refletem o scroll acima.
      const rect = droppableRects.get(target.id);
      if (!rect) return;
      return {
        x: rect.left + rect.width / 2 - collisionRect.width / 2,
        y: rect.top + rect.height / 2 - collisionRect.height / 2,
      };
    }

    case KeyboardCode.Up:
    case KeyboardCode.Down: {
      if (!collisionRect) return sortableKeyboardCoordinates(event, args);

      // Só os cards da coluna sob o card arrastado entram na disputa — sem isso o
      // sortable pula para um card de outra coluna quando não há vizinho na direção.
      const cx = collisionRect.left + collisionRect.width / 2;
      const column = droppableContainers
        .getEnabled()
        .map((entry) => (isColumn(entry) ? droppableRects.get(entry.id) : undefined))
        .find((rect) => rect && cx >= rect.left && cx <= rect.right);
      if (!column) return sortableKeyboardCoordinates(event, args);

      const inColumn = (entry: DroppableContainer) => {
        if (isColumn(entry)) return false;
        const rect = droppableRects.get(entry.id);
        if (!rect) return false;
        const center = rect.left + rect.width / 2;
        return center >= column.left && center <= column.right;
      };
      // Cópia do mapa (o sortable ainda precisa do `get` do card ativo, mesmo que o
      // lugar de origem dele esteja em outra coluna); só a lista de candidatos é filtrada.
      const Ctor = droppableContainers.constructor as new (
        entries: Iterable<[UniqueIdentifier, DroppableContainer]>
      ) => DroppableContainers;
      const scoped = new Ctor(droppableContainers);
      scoped.getEnabled = () => droppableContainers.getEnabled().filter(inColumn);

      return sortableKeyboardCoordinates(event, {
        ...args,
        context: { ...args.context, droppableContainers: scoped },
      });
    }
  }

  return undefined;
};
