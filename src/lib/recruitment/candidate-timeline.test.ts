import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCandidateTimeline, groupEventsByDay } from "./candidate-timeline";

const HISTORY = [
  { id: "h1", stageId: "NEW", stage: { name: "Novas candidaturas" }, changedBy: "Candidato (portal)", changedAt: "2026-09-21T16:49:10Z" },
  { id: "h2", stageId: "SCR", stage: { name: "Triagem" }, changedBy: "Murilo Bremer", changedAt: "2026-09-22T18:41:00Z" },
  { id: "h3", stageId: "LOST", stage: { name: "Cancelada" }, changedBy: "Murilo Bremer", changedAt: "2026-09-22T18:45:00Z" },
];

test("entrada + trocas de etapa com origem → destino; reprovação vira evento próprio", () => {
  const ev = buildCandidateTimeline({
    createdAt: "2026-09-21T16:49:00Z",
    sourceLabel: "Portal",
    addedBy: null,
    stageHistory: HISTORY,
    lostStageId: "LOST",
  });
  assert.deepEqual(
    ev.map((e) => e.type),
    ["REJECTED", "STAGE_CHANGED", "APPLICATION_RECEIVED"]
  );
  assert.equal(ev[1].detail, "Novas candidaturas → Triagem");
  assert.equal(ev[1].actor, "Murilo Bremer");
  assert.equal(ev[2].detail, "Via Portal");
  // Entrada feita pelo próprio candidato não vira "autor".
  assert.equal(ev[2].actor, null);
});

test("avaliações, testes e anotações entram como eventos reais", () => {
  const ev = buildCandidateTimeline({
    createdAt: "2026-09-21T16:49:00Z",
    sourceLabel: "Portal",
    addedBy: null,
    stageHistory: [],
    lostStageId: null,
    assessments: [
      { id: "a1", kind: "AI_FIT", source: "AI", title: null, score: 82.6, evaluator: "IA · Gemini", occurredAt: "2026-09-21T17:00:00Z", createdAt: "2026-09-21T17:00:00Z" },
      { id: "a2", kind: "INTERVIEW", source: "HUMAN", title: null, score: null, evaluator: "Ana", occurredAt: "2026-09-25T12:00:00Z", createdAt: "2026-09-22T10:00:00Z", createdBy: "Ana" },
      { id: "a3", kind: "PERSONALITY_TEST", source: "HUMAN", title: null, score: null, evaluator: "Automático", occurredAt: null, createdAt: "2026-09-22T11:00:00Z" },
    ],
    sessions: [
      { id: "s1", template: { name: "Big Five" }, submittedAt: "2026-09-22T11:00:00Z", sentBy: "Ana", createdAt: "2026-09-22T09:00:00Z" },
    ],
    notes: [{ id: "n1", body: "Boa comunicação.\nDisponibilidade imediata.", authorName: "Murilo Bremer", createdAt: "2026-09-22T12:00:00Z" }],
  });
  const types = ev.map((e) => e.type);
  assert.deepEqual(types, ["NOTE_ADDED", "TEST_COMPLETED", "INTERVIEW_SCHEDULED", "TEST_SENT", "AI_ANALYSIS", "APPLICATION_RECEIVED"]);
  assert.equal(ev.find((e) => e.type === "AI_ANALYSIS")?.detail, "83% de aderência");
  assert.equal(ev.find((e) => e.type === "INTERVIEW_SCHEDULED")?.detail, "Para 25/09");
  assert.equal(ev[0].detail, "Boa comunicação. Disponibilidade imediata.");
  // Tipos sem fonte de dados nunca são gerados.
  assert.ok(!types.includes("CONTACT_MADE") && !types.includes("OWNER_CHANGED"));
});

test("agrupa por dia no fuso de São Paulo: Hoje, Ontem e data", () => {
  const now = new Date("2026-09-22T20:00:00Z"); // 17h em SP
  const groups = groupEventsByDay(
    [
      { at: "2026-09-22T18:41:00Z" },
      { at: "2026-09-22T02:00:00Z" }, // 23h do dia 21 em SP
      { at: "2026-09-19T12:00:00Z" },
    ],
    now
  );
  assert.deepEqual(
    groups.map((g) => [g.label, g.items.length]),
    [["Hoje", 1], ["Ontem", 1], ["19 de set.", 1]]
  );
});
