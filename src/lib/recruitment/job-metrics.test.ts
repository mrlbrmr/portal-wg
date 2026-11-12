import { test } from "node:test";
import assert from "node:assert/strict";
import { isCountedOpenJob, isOpenTalentPool, summarizeJobs } from "./job-metrics";

const job = (over: Partial<{ status: string; isTalentPool: boolean; candidateCount: number; newCount: number }>) => ({
  status: "ACTIVE",
  isTalentPool: false,
  candidateCount: 0,
  newCount: 0,
  ...over,
});

test("vaga contínua nunca é vaga aberta; etapas legadas contam como abertas", () => {
  assert.equal(isCountedOpenJob(job({})), true);
  assert.equal(isCountedOpenJob(job({ status: "SCREENING" })), true);
  assert.equal(isCountedOpenJob(job({ isTalentPool: true })), false);
  assert.equal(isCountedOpenJob(job({ status: "FILLED" })), false);
  assert.equal(isCountedOpenJob(job({ status: "DRAFT" })), false);
  assert.equal(isOpenTalentPool(job({ isTalentPool: true })), true);
  assert.equal(isOpenTalentPool(job({ isTalentPool: true, status: "CLOSED" })), false);
});

test("resumo: o cenário da auditoria (2 vagas + banco contínuo com 18 novos)", () => {
  const m = summarizeJobs([
    job({ isTalentPool: true, candidateCount: 21, newCount: 18 }),
    job({ candidateCount: 5 }),
    job({ candidateCount: 2 }),
    job({ status: "FILLED", candidateCount: 9, newCount: 3 }),
  ]);
  assert.equal(m.openJobs.length, 2);
  assert.equal(m.talentPools.length, 1);
  assert.equal(m.activeCandidates, 7);
  assert.equal(m.awaitingTriage, 0);
  assert.equal(m.talentPoolAwaitingTriage, 18);
});

test("resumo vazio", () => {
  const m = summarizeJobs([]);
  assert.deepEqual(
    { open: m.openJobs.length, pools: m.talentPools.length, a: m.activeCandidates, t: m.awaitingTriage, p: m.talentPoolAwaitingTriage },
    { open: 0, pools: 0, a: 0, t: 0, p: 0 }
  );
});
