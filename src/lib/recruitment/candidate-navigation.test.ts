import { test } from "node:test";
import assert from "node:assert/strict";
import { isTypingTarget, queuePosition } from "./candidate-navigation";

const Q = ["a", "b", "c", "d", "e"];

test("posição e vizinhos na fila", () => {
  assert.deepEqual(queuePosition(Q, "a"), { index: 1, total: 5, prevId: null, nextId: "b" });
  assert.deepEqual(queuePosition(Q, "c"), { index: 3, total: 5, prevId: "b", nextId: "d" });
  assert.deepEqual(queuePosition(Q, "e"), { index: 5, total: 5, prevId: "d", nextId: null });
});

test("candidato que saiu da fila: segue a partir da última posição conhecida", () => {
  // "c" estava na posição 2 (0-based) e foi reprovado → fila sem ele.
  const after = ["a", "b", "d", "e"];
  assert.deepEqual(queuePosition(after, "c", 2), { index: null, total: 4, prevId: "b", nextId: "d" });
  assert.deepEqual(queuePosition(["a"], "z", 5), { index: null, total: 1, prevId: "a", nextId: null });
  assert.deepEqual(queuePosition(after, "c"), { index: null, total: 4, prevId: null, nextId: null });
});

test("isTypingTarget: campos de texto bloqueiam atalhos; botões e checkboxes não", () => {
  const el = (tagName: string, extra: Record<string, unknown> = {}) =>
    ({ tagName, closest: () => null, ...extra }) as unknown as EventTarget;
  assert.equal(isTypingTarget(el("TEXTAREA")), true);
  assert.equal(isTypingTarget(el("SELECT")), true);
  assert.equal(isTypingTarget(el("INPUT", { type: "text" })), true);
  assert.equal(isTypingTarget(el("INPUT", { type: "checkbox" })), false);
  assert.equal(isTypingTarget(el("BUTTON")), false);
  assert.equal(isTypingTarget(el("DIV", { isContentEditable: true })), true);
  assert.equal(isTypingTarget(null), false);
  // Componentes de edição customizados (combobox, busca) também bloqueiam.
  const inside = (selector: string) =>
    ({ tagName: "SPAN", closest: (s: string) => (s.includes(selector) ? {} : null) }) as unknown as EventTarget;
  assert.equal(isTypingTarget(inside("[role='combobox']")), true);
  assert.equal(isTypingTarget(inside("[role='searchbox']")), true);
  assert.equal(isTypingTarget(inside("[contenteditable='plaintext-only']")), true);
});
