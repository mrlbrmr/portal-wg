import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScheduleInput } from "./schema";

const NOW = new Date("2026-11-12T15:00:00Z");
const ok = {
  applicationId: "11111111-1111-1111-1111-111111111111",
  round: "HR",
  scheduledAt: "2026-11-20T13:00:00.000Z",
  durationMin: 45,
};

test("aceita entrada válida", () => {
  const r = parseScheduleInput(ok, NOW);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.allowPast, false);
});

test("durationMin fora de 5–480 é rejeitado", () => {
  assert.equal(parseScheduleInput({ ...ok, durationMin: 4 }, NOW).ok, false);
  assert.equal(parseScheduleInput({ ...ok, durationMin: 481 }, NOW).ok, false);
  assert.equal(parseScheduleInput({ ...ok, durationMin: 5 }, NOW).ok, true);
  assert.equal(parseScheduleInput({ ...ok, durationMin: 480 }, NOW).ok, true);
});

test("durationMin ausente vira 60", () => {
  const { durationMin: _d, ...rest } = ok;
  const r = parseScheduleInput(rest, NOW);
  assert.equal(r.ok && r.value.durationMin, 60);
});

test("round só HR ou MANAGER", () => {
  assert.equal(parseScheduleInput({ ...ok, round: "TECHNICAL" }, NOW).ok, false);
  assert.equal(parseScheduleInput({ ...ok, round: "MANAGER" }, NOW).ok, true);
});

test("data no passado", () => {
  const past = { ...ok, scheduledAt: "2026-11-01T13:00:00.000Z" };
  const r = parseScheduleInput(past, NOW);
  assert.deepEqual(r, { ok: false, error: "A data da entrevista deve ser futura." });
  assert.equal(parseScheduleInput({ ...past, allowPast: true }, NOW).ok, true);
});

test("textos vazios viram null", () => {
  const r = parseScheduleInput({ ...ok, location: "  ", interviewerName: "", notes: "   " }, NOW);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.location, null);
    assert.equal(r.value.interviewerName, null);
    assert.equal(r.value.notes, null);
  }
});

test("scheduledAt fora do formato ISO é rejeitado", () => {
  assert.equal(parseScheduleInput({ ...ok, scheduledAt: "12/11/2026 14:00" }, NOW).ok, false);
  assert.equal(parseScheduleInput({ ...ok, scheduledAt: "2026-11-20" }, NOW).ok, false);
});
