// Testes da escolha de coluna no arraste por teclado do Kanban (`npm test`).
// A parte que depende do DOM (rolagem, rects vivos do dnd-kit) foi validada no navegador;
// aqui fica a geometria pura: qual coluna recebe o card em cada seta.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findNeighborColumn } from "./kanban-keyboard";

// Colunas de 260px com vão de 14px, como no KanbanBoardShell. Fora de ordem de propósito.
const columns = [
  { id: "b", left: 274, right: 534 },
  { id: "a", left: 0, right: 260 },
  { id: "c", left: 548, right: 808 },
];

describe("findNeighborColumn", () => {
  it("→ vai para a coluna seguinte e ← para a anterior", () => {
    assert.equal(findNeighborColumn(columns, 404, "right")?.id, "c");
    assert.equal(findNeighborColumn(columns, 404, "left")?.id, "a");
  });

  it("não sai do quadro nas bordas", () => {
    assert.equal(findNeighborColumn(columns, 130, "left"), null);
    assert.equal(findNeighborColumn(columns, 678, "right"), null);
  });

  it("vale mesmo com o ponto fora do centro da coluna (e com colunas roladas para fora)", () => {
    const scrolled = columns.map((c) => ({ ...c, left: c.left - 500, right: c.right - 500 }));
    assert.equal(findNeighborColumn(scrolled, -490, "right")?.id, "b");
  });

  it("no vão entre colunas escolhe a primeira coluna do lado pedido", () => {
    assert.equal(findNeighborColumn(columns, 267, "right")?.id, "b");
    assert.equal(findNeighborColumn(columns, 267, "left")?.id, "a");
  });

  it("não reordena o array recebido", () => {
    const input = [...columns];
    findNeighborColumn(input, 267, "left");
    assert.deepEqual(input, columns);
  });
});
