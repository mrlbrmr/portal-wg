import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCancelReason } from "./schema";

test("motivo vazio ou ausente vira null", () => {
  assert.deepEqual(parseCancelReason(undefined), { ok: true, value: null });
  assert.deepEqual(parseCancelReason("   "), { ok: true, value: null });
});

test("motivo é aparado e limitado a 500", () => {
  assert.deepEqual(parseCancelReason("  desistiu "), { ok: true, value: "desistiu" });
  assert.equal(parseCancelReason("a".repeat(500)).ok, true);
  assert.equal(parseCancelReason("a".repeat(501)).ok, false);
  assert.equal(parseCancelReason(5).ok, false);
});
