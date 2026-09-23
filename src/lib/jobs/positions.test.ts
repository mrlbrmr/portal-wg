import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAddPosition,
  canCancelPosition,
  canFillPosition,
  canReleasePosition,
  occupiedApplicationIds,
  positionLabel,
  progressLabel,
  remainingLabel,
  shouldOfferClosing,
  sortPositions,
  summarizePositions,
  type PositionStatus,
} from "./positions";

const pos = (positionNumber: number, status: PositionStatus, applicationId: string | null = null) => ({
  positionNumber,
  status,
  applicationId,
});

test("identificação amigável #01, #02, #10", () => {
  assert.equal(positionLabel(1), "#01");
  assert.equal(positionLabel(2), "#02");
  assert.equal(positionLabel(10), "#10");
});

test("cenário 1 — uma posição em aberto", () => {
  const s = summarizePositions([pos(1, "OPEN")]);
  assert.deepEqual([s.total, s.filled, s.open, s.state], [1, 0, 1, "OPEN"]);
  assert.equal(progressLabel(s), "0 de 1 posição preenchida");
  assert.equal(remainingLabel(s), "1 posição restante");
});

test("cenário 3 — #01 preenchida de 2 → parcialmente preenchida", () => {
  const s = summarizePositions([pos(1, "FILLED", "a"), pos(2, "OPEN")]);
  assert.equal(s.state, "PARTIAL");
  assert.equal(progressLabel(s), "1 de 2 posições preenchidas");
  assert.equal(remainingLabel(s), "1 posição restante");
  assert.equal(s.percent, 50);
  assert.equal(shouldOfferClosing(s, true), false);
});

test("cenário 4 — 2 de 2 preenchidas → oferece encerrar (só se publicada)", () => {
  const s = summarizePositions([pos(1, "FILLED", "a"), pos(2, "FILLED", "b")]);
  assert.equal(s.state, "ALL_FILLED");
  assert.equal(remainingLabel(s), "Todas as posições preenchidas");
  assert.equal(shouldOfferClosing(s, true), true);
  assert.equal(shouldOfferClosing(s, false), false);
});

test("canceladas não contam no total (nunca '3 preenchidas de 2')", () => {
  const s = summarizePositions([pos(1, "FILLED", "a"), pos(2, "FILLED", "b"), pos(3, "CANCELLED")]);
  assert.deepEqual([s.total, s.filled, s.cancelled], [2, 2, 1]);
  assert.ok(s.filled <= s.total);
});

test("cenário 5 — só posição preenchida pode ser liberada", () => {
  assert.equal(canReleasePosition(pos(1, "FILLED", "a")).ok, true);
  assert.equal(canReleasePosition(pos(1, "OPEN")).ok, false);
});

test("cenário 6 — banco de talentos não tem posições; vaga específica pode adicionar", () => {
  assert.equal(canAddPosition({ isTalentPool: false }).ok, true);
  assert.equal(canAddPosition({ isTalentPool: true }).ok, false);
});

test("cenário 7 — cancelar posição aberta quando há outras ativas", () => {
  const all = [pos(1, "FILLED", "a"), pos(2, "OPEN"), pos(3, "OPEN")];
  assert.equal(canCancelPosition(all[2], all).ok, true);
});

test("cenário 8 — posição preenchida não pode ser cancelada", () => {
  const all = [pos(1, "FILLED", "a"), pos(2, "OPEN")];
  const r = canCancelPosition(all[0], all);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : "", /#01 está preenchida/);
});

test("vaga específica mantém ao menos 1 posição ativa", () => {
  const all = [pos(1, "OPEN"), pos(2, "CANCELLED")];
  assert.equal(canCancelPosition(all[0], all).ok, false);
});

test("posição preenchida não aceita outro contratado; candidato não ocupa duas", () => {
  const all = [pos(1, "FILLED", "a"), pos(2, "OPEN")];
  assert.equal(canFillPosition(all[0], "b", all).ok, false);
  const twice = canFillPosition(all[1], "a", all);
  assert.equal(twice.ok, false);
  assert.match(!twice.ok ? twice.reason : "", /#01/);
  assert.equal(canFillPosition(all[1], "b", all).ok, true);
  assert.deepEqual([...occupiedApplicationIds(all)], ["a"]);
});

test("ordenação: ativas por número, canceladas no fim", () => {
  const sorted = sortPositions([pos(3, "OPEN"), pos(1, "CANCELLED"), pos(2, "FILLED", "a")]);
  assert.deepEqual(sorted.map((p) => p.positionNumber), [2, 3, 1]);
});
