import { test } from "node:test";
import assert from "node:assert/strict";
import {
  brtLocalToIso,
  isoToBrtLocal,
  formatInterviewWhen,
  isOverdue,
  pickInterviewForCard,
  interviewSignalLabel,
  canTransition,
  findConflicts,
} from "./rules";
import type { InterviewStatus } from "./catalog";

const NOW = new Date("2026-11-12T15:00:00Z"); // 12h BRT

test("brtLocalToIso / isoToBrtLocal", () => {
  assert.equal(brtLocalToIso("2026-11-12T14:00"), "2026-11-12T17:00:00.000Z");
  assert.equal(brtLocalToIso("2026-11-12T22:30"), "2026-11-13T01:30:00.000Z");
  assert.equal(isoToBrtLocal("2026-11-13T01:30:00.000Z"), "2026-11-12T22:30");
});

test("formatInterviewWhen", () => {
  assert.equal(formatInterviewWhen("2026-11-12T17:00:00.000Z"), "12/11 · 14h");
  assert.equal(formatInterviewWhen("2026-11-13T01:30:00.000Z"), "12/11 · 22h30");
});

test("isOverdue", () => {
  const i = { status: "SCHEDULED" as InterviewStatus, scheduledAt: "2026-11-12T17:00:00.000Z", durationMin: 60 };
  assert.equal(isOverdue(i, NOW), false);
  assert.equal(isOverdue(i, new Date("2026-11-12T17:59:00Z")), false); // 14h59
  assert.equal(isOverdue(i, new Date("2026-11-12T18:01:00Z")), true); // 15h01
  assert.equal(isOverdue({ ...i, status: "DONE" }, new Date("2026-11-12T18:01:00Z")), false);
});

test("pickInterviewForCard", () => {
  const mk = (id: string, scheduledAt: string, status: InterviewStatus = "SCHEDULED") => ({
    id, status, scheduledAt, durationMin: 60, round: "HR",
  });
  const future1 = mk("f1", "2026-11-20T13:00:00Z");
  const future2 = mk("f2", "2026-11-14T13:00:00Z");
  const late1 = mk("o1", "2026-11-10T13:00:00Z");
  const late2 = mk("o2", "2026-11-11T13:00:00Z");
  const r = pickInterviewForCard([future1, future2, late1], NOW);
  assert.equal(r?.item.id, "f2");
  assert.equal(r?.overdue, false);
  const r2 = pickInterviewForCard([late1, late2], NOW);
  assert.equal(r2?.item.id, "o2");
  assert.equal(r2?.overdue, true);
  assert.equal(pickInterviewForCard([mk("c", "2026-11-14T13:00:00Z", "CANCELLED"), mk("d", "2026-11-14T13:00:00Z", "DONE")], NOW), null);
});

test("interviewSignalLabel", () => {
  assert.equal(interviewSignalLabel("HR", "2026-11-12T17:00:00Z", NOW), "Entrevista G&G · hoje 14h");
  assert.equal(interviewSignalLabel("HR", "2026-11-13T12:00:00Z", NOW), "Entrevista G&G · amanhã 9h");
  assert.equal(interviewSignalLabel("MANAGER", "2026-11-20T13:00:00Z", NOW), "Entrevista Gestor · 20/11 10h");
});

test("canTransition", () => {
  for (const to of ["DONE", "CANCELLED", "NO_SHOW"] as InterviewStatus[]) assert.equal(canTransition("SCHEDULED", to), true);
  assert.equal(canTransition("SCHEDULED", "SCHEDULED"), false);
  for (const from of ["DONE", "CANCELLED", "NO_SHOW"] as InterviewStatus[]) {
    for (const to of ["SCHEDULED", "DONE", "CANCELLED", "NO_SHOW"] as InterviewStatus[]) assert.equal(canTransition(from, to), false);
  }
});

test("findConflicts", () => {
  const base = { id: "a", interviewerName: "Ana Souza", scheduledAt: "2026-11-12T17:00:00.000Z", durationMin: 60, status: "SCHEDULED" as InterviewStatus };
  const cand = { interviewerName: "  ana   SOUZA ", scheduledAt: "2026-11-12T17:30:00.000Z", durationMin: 60 };
  assert.deepEqual(findConflicts(cand, [base]), ["a"]);
  assert.deepEqual(findConflicts({ ...cand, scheduledAt: "2026-11-12T18:00:00.000Z" }, [base]), []);
  assert.deepEqual(findConflicts({ ...cand, interviewerName: "Bia" }, [base]), []);
  assert.deepEqual(findConflicts({ ...cand, interviewerName: null }, [{ ...base, interviewerName: null }]), []);
  assert.deepEqual(findConflicts({ ...cand, interviewerName: "  " }, [{ ...base, interviewerName: "  " }]), []);
  assert.deepEqual(findConflicts(cand, [{ ...base, status: "CANCELLED" }]), []);
  assert.deepEqual(findConflicts({ ...cand, id: "a" }, [base]), []);
  assert.deepEqual(findConflicts({ ...cand, interviewerName: "Jose Souza" }, [{ ...base, interviewerName: "José Souza" }]), ["a"]);
});
