import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateStageFlow, enteredCurrentStageAt } from "./candidate-stage-flow";

// Funil padrão da WG (sortOrder), incluindo as etapas ocultas.
const STAGES = [
  { id: "NEW", name: "Novas candidaturas", color: "#000", kind: "OPEN" },
  { id: "SCREENING", name: "Triagem", color: "#000", kind: "OPEN" },
  { id: "T1", name: "Teste de personalidade", color: "#000", kind: "TEST" },
  { id: "INTERVIEW", name: "Entrevista G&G", color: "#000", kind: "OPEN" },
  { id: "ADM", name: "Admissão", color: "#000", kind: "ADMISSION" },
  { id: "HIRED", name: "Finalizada", color: "#000", kind: "WON" },
  { id: "REJECTED", name: "Cancelada", color: "#000", kind: "LOST", hideFromBoard: true },
  { id: "PAUSED", name: "Pausada", color: "#000", kind: "OPEN", hideFromBoard: true },
];

test("nova candidatura: avança para a próxima etapa real e não tem 'voltar'", () => {
  const f = candidateStageFlow(STAGES, "NEW");
  assert.equal(f.status, "OPEN");
  assert.equal(f.next?.id, "SCREENING");
  assert.equal(f.previous, null);
  assert.equal(f.lost?.id, "REJECTED");
  assert.deepEqual(f.position, { index: 1, total: 6 });
});

test("etapa do meio: próxima e anterior seguem a ordem do funil visível", () => {
  const f = candidateStageFlow(STAGES, "T1");
  assert.equal(f.next?.id, "INTERVIEW");
  assert.equal(f.previous?.id, "SCREENING");
});

test("última etapa visível nunca avança para etapa oculta (Pausada)", () => {
  const f = candidateStageFlow(STAGES, "HIRED");
  assert.equal(f.status, "FINAL");
  assert.equal(f.next, null);
  assert.equal(f.previous?.id, "ADM");
});

test("reprovado: sem reprovar de novo; retoma na última etapa do funil em que esteve", () => {
  const f = candidateStageFlow(STAGES, "REJECTED", ["NEW", "SCREENING", "T1", "REJECTED"]);
  assert.equal(f.status, "LOST");
  assert.equal(f.lost, null);
  assert.equal(f.next, null);
  assert.equal(f.resumeTo?.id, "T1");
  assert.ok(!f.moveTargets.some((s) => s.kind === "LOST"));
});

test("pausado (oculto): fora do funil, retoma pela história ou pela 1ª etapa", () => {
  const f = candidateStageFlow(STAGES, "PAUSED", ["NEW", "SCREENING", "PAUSED"]);
  assert.equal(f.status, "OFF_PIPELINE");
  assert.equal(f.position, null);
  assert.equal(f.resumeTo?.id, "SCREENING");
  assert.equal(candidateStageFlow(STAGES, "PAUSED", []).resumeTo?.id, "NEW");
});

test("destinos de 'Mover para' excluem a etapa atual e a de reprovação", () => {
  const ids = candidateStageFlow(STAGES, "SCREENING").moveTargets.map((s) => s.id);
  assert.ok(!ids.includes("SCREENING"));
  assert.ok(!ids.includes("REJECTED"));
  assert.ok(ids.includes("PAUSED"));
});

test("funil sem etapa LOST: não oferece reprovar", () => {
  const f = candidateStageFlow(STAGES.filter((s) => s.kind !== "LOST"), "NEW");
  assert.equal(f.lost, null);
});

test("tempo na etapa só quando o histórico confirma a etapa atual", () => {
  const h = [
    { stageId: "NEW", changedAt: "2026-09-20T10:00:00Z" },
    { stageId: "SCREENING", changedAt: "2026-09-21T10:00:00Z" },
  ];
  assert.equal(enteredCurrentStageAt(h, "SCREENING"), "2026-09-21T10:00:00Z");
  assert.equal(enteredCurrentStageAt(h, "NEW"), null);
  assert.equal(enteredCurrentStageAt([], "NEW"), null);
});
