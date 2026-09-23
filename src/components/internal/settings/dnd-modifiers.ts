import type { Modifier } from "@dnd-kit/core";

/** Trava o arraste no eixo vertical (equivalente ao de @dnd-kit/modifiers, sem a dependência). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });
