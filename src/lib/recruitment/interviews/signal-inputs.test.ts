import { test } from "node:test";
import assert from "node:assert/strict";
import { agendaSignalInputs } from "./signal-inputs";

const row = (status: "SCHEDULED" | "DONE" | "CANCELLED" | "NO_SHOW") => ({
  round: "HR", scheduledAt: "2026-11-12T17:00:00Z", durationMin: 60, status,
});

test("sem linhas na agenda: mantém o valor legado e interviews vazio", () => {
  assert.deepEqual(agendaSignalInputs([], "2026-11-20T10:00:00Z"), { nextInterviewAt: "2026-11-20T10:00:00Z", interviews: [] });
  assert.deepEqual(agendaSignalInputs(null, "2026-11-20T10:00:00Z"), { nextInterviewAt: "2026-11-20T10:00:00Z", interviews: [] });
});

test("só linhas DONE/CANCELLED: legado descartado e interviews vazio", () => {
  const out = agendaSignalInputs([row("DONE"), row("CANCELLED")], "2026-11-20T10:00:00Z");
  assert.equal(out.nextInterviewAt, null);
  assert.deepEqual(out.interviews, []);
});

test("uma SCHEDULED e uma DONE: legado descartado, só a SCHEDULED segue", () => {
  const sched = row("SCHEDULED");
  const out = agendaSignalInputs([sched, row("DONE")], "2026-11-20T10:00:00Z");
  assert.equal(out.nextInterviewAt, null);
  assert.deepEqual(out.interviews, [sched]);
});
