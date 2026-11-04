import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJobInterviewItems } from "./job-items";

const now = new Date("2026-11-10T15:00:00Z");
const base = { applicationId: "a", round: "GG", durationMin: 60, interviewerName: null, location: null };

test("atrasadas primeiro, depois próximas por horário; embed objeto ou array", () => {
  const out = buildJobInterviewItems(
    [
      { ...base, id: "1", scheduledAt: "2026-11-12T13:00:00Z", application: { fullName: "Ana" } },
      { ...base, id: "2", scheduledAt: "2026-11-09T13:00:00Z", application: [{ fullName: "Bia" }] },
      { ...base, id: "3", scheduledAt: "2026-11-11T13:00:00Z", application: null },
      { ...base, id: "4", scheduledAt: "invalida" },
    ],
    now,
  );
  assert.deepEqual(out.map((i) => i.id), ["2", "3", "1"]);
  assert.equal(out[0].overdue, true);
  assert.equal(out[0].candidateName, "Bia");
  assert.equal(out[1].candidateName, "Candidato");
  assert.equal(out[2].overdue, false);
});

test("candidaturas inativas ficam fora do painel quando o conjunto de ativas é informado", () => {
  const rows = [
    { ...base, id: "1", applicationId: "ativa", scheduledAt: "2026-11-09T13:00:00Z", application: { fullName: "Ana" } },
    { ...base, id: "2", applicationId: "reprovada", scheduledAt: "2026-11-09T13:00:00Z", application: { fullName: "Bia" } },
  ];
  assert.deepEqual(buildJobInterviewItems(rows, now, new Set(["ativa"])).map((i) => i.id), ["1"]);
  assert.equal(buildJobInterviewItems(rows, now).length, 2);
});
