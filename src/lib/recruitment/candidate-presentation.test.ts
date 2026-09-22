import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarDaysSince,
  candidateInitials,
  candidateSignals,
  enteredStageAtFromLatest,
  formatAppliedAgo,
  formatExperience,
  formatInterviewLabel,
  formatStageTime,
  pipelineSummary,
  STAGE_IDLE_WARNING_DAYS,
} from "./candidate-presentation";

const STAGES = [
  { id: "NEW", name: "Novas candidaturas", color: "#000", kind: "OPEN" },
  { id: "SCREENING", name: "Triagem", color: "#000", kind: "OPEN" },
  { id: "T1", name: "Teste de personalidade", color: "#000", kind: "TEST" },
  { id: "ADM", name: "Admissão", color: "#000", kind: "ADMISSION" },
  { id: "HIRED", name: "Finalizada", color: "#000", kind: "WON" },
  { id: "REJECTED", name: "Cancelada", color: "#000", kind: "LOST", hideFromBoard: true },
  { id: "PAUSED", name: "Pausada", color: "#000", kind: "OPEN", hideFromBoard: true },
];

// 22/09/2026 10h em São Paulo (13h UTC).
const NOW = new Date("2026-09-22T13:00:00Z");

test("iniciais: duas primeiras palavras, ignorando partículas", () => {
  assert.equal(candidateInitials("Wellington Marcelo de Souza"), "WM");
  assert.equal(candidateInitials("Maria da Silva"), "MS");
  assert.equal(candidateInitials("  ana  "), "AN");
  assert.equal(candidateInitials(""), "?");
});

test("dias de calendário usam o fuso de São Paulo", () => {
  // 21/09 23h30 em SP (22/09 02h30 UTC) foi ONTEM, mesmo com menos de 24h.
  assert.equal(calendarDaysSince("2026-09-22T02:30:00Z", NOW), 1);
  assert.equal(calendarDaysSince("2026-09-22T10:00:00Z", NOW), 0);
});

test("textos de candidatura e de tempo na etapa", () => {
  assert.equal(formatAppliedAgo("2026-09-22T11:00:00Z", NOW), "Candidatou-se hoje");
  assert.equal(formatAppliedAgo("2026-09-21T15:00:00Z", NOW), "Candidatou-se ontem");
  assert.equal(formatAppliedAgo("2026-09-20T15:00:00Z", NOW), "Candidatou-se há 2 dias");
  assert.equal(formatStageTime("2026-09-22T11:00:00Z", NOW), "Entrou nesta etapa hoje");
  assert.equal(formatStageTime("2026-09-18T15:00:00Z", NOW), "Nesta etapa há 4 dias");
});

test("tempo na etapa só existe quando o último histórico é a etapa atual", () => {
  assert.equal(enteredStageAtFromLatest({ stageId: "NEW", changedAt: "x" }, "NEW"), "x");
  assert.equal(enteredStageAtFromLatest({ stageId: "NEW", changedAt: "x" }, "SCREENING"), null);
  assert.equal(enteredStageAtFromLatest(undefined, "NEW"), null);
});

test("resumo do pipeline agrupa pela semântica das etapas", () => {
  const s = pipelineSummary(
    [{ stageId: "NEW" }, { stageId: "NEW" }, { stageId: "T1" }, { stageId: "ADM" }, { stageId: "PAUSED" }, { stageId: "REJECTED" }],
    STAGES
  );
  assert.deepEqual(s, { total: 6, NEW: 2, IN_PROCESS: 1, FINALIST: 1, CLOSED: 2 });
});

test("sinal de etapa parada só no funil em andamento e acima do limite", () => {
  assert.ok(STAGE_IDLE_WARNING_DAYS !== null);
  const old = "2026-09-01T12:00:00Z";
  const idle = candidateSignals({ stageId: "SCREENING", enteredStageAt: old }, STAGES[1], NOW);
  assert.equal(idle[0]?.key, "idle");
  assert.equal(idle[0]?.attention, true);
  // Admissão é etapa de espera natural — não vira alerta.
  assert.equal(candidateSignals({ stageId: "ADM", enteredStageAt: old }, STAGES[3], NOW).length, 0);
  // Sem data de entrada na etapa, não há alerta (nada de dado chutado).
  assert.equal(candidateSignals({ stageId: "SCREENING", enteredStageAt: null }, STAGES[1], NOW).length, 0);
});

test("sinal de teste só aparece na etapa de teste", () => {
  const onTest = candidateSignals({ stageId: "T1", enteredStageAt: null, testStatus: "NOT_SENT" }, STAGES[2], NOW);
  assert.equal(onTest[0]?.label, "Teste não enviado");
  const elsewhere = candidateSignals({ stageId: "NEW", enteredStageAt: null, testStatus: "NOT_SENT" }, STAGES[0], NOW);
  assert.equal(elsewhere.length, 0);
});

test("entrevista: hoje, amanhã, data futura; passadas somem", () => {
  assert.equal(formatInterviewLabel("2026-09-22T00:00:00.000Z", NOW), "Entrevista hoje");
  assert.equal(formatInterviewLabel("2026-09-23T12:00:00Z", NOW), "Entrevista amanhã");
  assert.equal(formatInterviewLabel("2026-10-05T00:00:00Z", NOW), "Entrevista 05/10");
  assert.equal(formatInterviewLabel("2026-09-20T00:00:00Z", NOW), null);
});

test("experiência vinda do perfil do CV", () => {
  assert.equal(formatExperience(null), null);
  assert.equal(formatExperience(0), "Menos de 1 ano de exp.");
  assert.equal(formatExperience(1), "1 ano de exp.");
  assert.equal(formatExperience(5), "5 anos de exp.");
});
