import { test } from "node:test";
import assert from "node:assert/strict";
import { desiredStartDateProblem, todayIsoInBrazil } from "./dates";

const today = new Date("2026-11-13T15:00:00Z"); // 12:00 em São Paulo

test("data desejada no passado é recusada; hoje e futuro passam", () => {
  assert.equal(desiredStartDateProblem("2026-11-12", today), "A data desejada não pode ser anterior a hoje.");
  assert.equal(desiredStartDateProblem("2026-11-13", today), null);
  assert.equal(desiredStartDateProblem("2027-01-05", today), null);
});

test("'hoje' segue o fuso de São Paulo, não o UTC", () => {
  // 01:30 UTC de 14/11 ainda é 13/11 em São Paulo.
  assert.equal(todayIsoInBrazil(new Date("2026-11-14T01:30:00Z")), "2026-11-13");
});

test("formato inválido é tratado pelo schema, não aqui", () => {
  assert.equal(desiredStartDateProblem("", today), null);
});
