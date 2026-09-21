import { test } from "node:test";
import assert from "node:assert/strict";
import { jobAttentionReasons, operationalSituation, ATTENTION_RULES } from "./attention";
import { evaluateSla } from "./sla";
import { jobLifecycle, jobProcessStage, parseLegacyStatusParam } from "./job-presentation";

const NOW = new Date("2026-09-21T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const base = {
  status: "ACTIVE",
  openedAt: daysAgo(2),
  lastActivityAt: daysAgo(1),
  candidateCount: 3,
  newCount: 0,
  closingDate: null,
};

test("vaga aberta recente e movimentada não pede atenção", () => {
  const r = jobAttentionReasons(base, NOW, null);
  assert.deepEqual(r, []);
  assert.equal(operationalSituation(r), "NORMAL");
});

test("vaga fora do status aberto nunca pede atenção", () => {
  for (const status of ["DRAFT", "PAUSED", "FILLED", "CLOSED"]) {
    assert.deepEqual(jobAttentionReasons({ ...base, status, newCount: 5 }, NOW, null), []);
  }
});

test("candidatos novos viram motivo explícito", () => {
  const r = jobAttentionReasons({ ...base, newCount: 3 }, NOW, null);
  assert.equal(r[0].label, "3 candidatos aguardando triagem");
  assert.equal(operationalSituation(r), "ATTENTION");
});

test("sem movimentação além do limite marca a vaga como atrasada", () => {
  const idle = ATTENTION_RULES.staleDays + 2;
  const r = jobAttentionReasons({ ...base, lastActivityAt: daysAgo(idle) }, NOW, null);
  assert.equal(r.find((x) => x.key === "STALE")?.label, `Sem movimentação há ${idle} dias`);
  assert.equal(operationalSituation(r), "LATE");
});

test("nenhum candidato após o limite", () => {
  const r = jobAttentionReasons({ ...base, candidateCount: 0, openedAt: daysAgo(12) }, NOW, null);
  assert.equal(r.find((x) => x.key === "NO_CANDIDATES")?.label, "Nenhum candidato em 12 dias");
});

test("prazo de inscrição próximo e vencido", () => {
  assert.equal(
    jobAttentionReasons({ ...base, closingDate: inDays(3.5) }, NOW, null)[0].label,
    "Inscrições encerram em 3 dias"
  );
  const passed = jobAttentionReasons({ ...base, closingDate: daysAgo(4) }, NOW, null)[0];
  assert.equal(passed.key, "CLOSING_PASSED");
  assert.equal(passed.tone, "danger");
});

test("SLA só avalia quando existe política", () => {
  assert.equal(evaluateSla(40, null), null);
  assert.equal(evaluateSla(3, { targetDays: 30, warningDays: 15 })?.state, "ON_TRACK");
  assert.equal(evaluateSla(17, { targetDays: 30, warningDays: 15 })?.state, "AT_RISK");
  const b = evaluateSla(34, { targetDays: 30, warningDays: 15 });
  assert.equal(b?.state, "BREACHED");
  assert.equal(b?.overByDays, 4);
  const r = jobAttentionReasons({ ...base, openedAt: daysAgo(34) }, NOW, { targetDays: 30, warningDays: 15 });
  assert.equal(r.find((x) => x.key === "SLA")?.label, "SLA excedido em 4 dias");
});

test("status do banco é projetado em status + etapa", () => {
  assert.equal(jobLifecycle("INTERVIEW"), "OPEN");
  assert.equal(jobProcessStage("INTERVIEW"), "INTERVIEW");
  assert.equal(jobProcessStage("ACTIVE"), null);
  assert.equal(jobLifecycle("FILLED"), "FILLED");
  assert.deepEqual(parseLegacyStatusParam("SCREENING"), { lifecycle: ["OPEN"], stage: ["SCREENING"] });
  assert.deepEqual(parseLegacyStatusParam("DRAFT,ATIVAS"), { lifecycle: ["DRAFT", "OPEN"], stage: [] });
});
