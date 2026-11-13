import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_BASE_RATE,
  MIN_BASE_SOURCE_RATE,
  MIN_BASE_TIME,
  buildRecruitmentReport,
  median,
  type ReportInput,
} from "./recruitment-report";

const NOW = new Date("2026-11-13T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const stages = [
  { id: "NEW", kind: "OPEN" },
  { id: "SCREENING", kind: "OPEN" },
  { id: "TEST", kind: "TEST" },
  { id: "INTERVIEW", kind: "OPEN" },
  { id: "HIRED", kind: "WON" },
  { id: "REJECTED", kind: "LOST" },
  { id: "ADM", kind: "ADMISSION" },
];

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    jobs: [
      { id: "j1", title: "Auxiliar de Logística", isTalentPool: false },
      { id: "pool", title: "Banco de Talentos", isTalentPool: true },
    ],
    stages,
    applications: [],
    history: [],
    hiredApplicationIds: [],
    positions: [],
    jobOpenedAt: { j1: day(40) },
    ...over,
  };
}

test("mediana", () => {
  assert.equal(median([]), null);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test("funil cumulativo pelas etapas visitadas; banco de talentos fica à parte", () => {
  const r = buildRecruitmentReport(
    input({
      applications: [
        { id: "a1", jobId: "j1", source: "PORTAL", createdAt: day(5), stageId: "NEW" },
        { id: "a2", jobId: "j1", source: "PORTAL", createdAt: day(5), stageId: "REJECTED" },
        { id: "a3", jobId: "j1", source: "CATHO", createdAt: day(5), stageId: "INTERVIEW" },
        { id: "a4", jobId: "j1", source: "CATHO", createdAt: day(5), stageId: "HIRED" },
        { id: "a5", jobId: "pool", source: "PORTAL", createdAt: day(5), stageId: "NEW" },
        { id: "old", jobId: "j1", source: "PORTAL", createdAt: day(200), stageId: "HIRED" },
      ],
      history: [
        { applicationId: "a2", stageId: "NEW" },
        { applicationId: "a2", stageId: "SCREENING" },
        { applicationId: "a2", stageId: "REJECTED" },
        { applicationId: "a3", stageId: "SCREENING" },
        { applicationId: "a3", stageId: "INTERVIEW" },
        { applicationId: "a4", stageId: "TEST" },
        { applicationId: "a4", stageId: "HIRED" },
      ],
    }),
    "30d",
    NOW
  );
  assert.equal(r.received, 4);
  assert.equal(r.talentPoolReceived, 1);
  assert.deepEqual(
    r.funnel.map((f) => [f.key, f.count]),
    [["received", 4], ["advanced", 3], ["evaluated", 2], ["hired", 1]]
  );
  // base pequena: sem percentual
  assert.ok(r.funnel.every((f) => f.pct === null));
});

test("admissão ligada conta como contratada mesmo sem etapa Aprovado", () => {
  const r = buildRecruitmentReport(
    input({
      applications: [{ id: "a1", jobId: "j1", source: "PORTAL", createdAt: day(3), stageId: "ADM" }],
      hiredApplicationIds: ["a1"],
    }),
    "30d",
    NOW
  );
  assert.equal(r.funnel.find((f) => f.key === "hired")?.count, 1);
});

test("percentual do funil só com base mínima", () => {
  const apps = Array.from({ length: MIN_BASE_RATE }, (_, i) => ({
    id: `a${i}`, jobId: "j1", source: "PORTAL", createdAt: day(2), stageId: i < 5 ? "HIRED" : "NEW",
  }));
  const r = buildRecruitmentReport(input({ applications: apps }), "30d", NOW);
  assert.equal(r.funnel.find((f) => f.key === "hired")?.pct, Math.round((5 / MIN_BASE_RATE) * 100));
});

test("por origem: taxa só com base mínima; ordem por volume", () => {
  const apps = [
    ...Array.from({ length: MIN_BASE_SOURCE_RATE }, (_, i) => ({
      id: `p${i}`, jobId: "j1", source: "PORTAL", createdAt: day(2), stageId: i === 0 ? "HIRED" : "NEW",
    })),
    { id: "c1", jobId: "j1", source: "CATHO", createdAt: day(2), stageId: "HIRED" },
  ];
  const r = buildRecruitmentReport(input({ applications: apps }), "30d", NOW);
  assert.deepEqual(r.bySource[0], { source: "PORTAL", received: MIN_BASE_SOURCE_RATE, hired: 1, rate: Math.round(100 / MIN_BASE_SOURCE_RATE) });
  assert.deepEqual(r.bySource[1], { source: "CATHO", received: 1, hired: 1, rate: null });
});

test("tempo até preencher: posições preenchidas no período, mediana só com base mínima", () => {
  const filled = (id: string, daysAgo: number) => ({ jobId: "j1", status: "FILLED", filledAt: day(daysAgo), id });
  const few = buildRecruitmentReport(input({ positions: [filled("p1", 10)] }), "30d", NOW);
  assert.equal(few.hires, 1);
  assert.equal(few.medianDaysToFill, null);

  const many = buildRecruitmentReport(
    input({ positions: Array.from({ length: MIN_BASE_TIME }, (_, i) => filled(`p${i}`, 10 + i)).concat([filled("old", 300)]) }),
    "30d",
    NOW
  );
  assert.equal(many.hires, MIN_BASE_TIME);
  // aberta há 40 dias; preenchidas há 10, 11, 12 dias → 30, 29, 28 dias → mediana 29
  assert.equal(many.medianDaysToFill, 29);
});

test("por vaga: candidaturas, contratadas e posições preenchidas no período", () => {
  const r = buildRecruitmentReport(
    input({
      applications: [
        { id: "a1", jobId: "j1", source: "PORTAL", createdAt: day(5), stageId: "HIRED" },
        { id: "a2", jobId: "j1", source: "PORTAL", createdAt: day(5), stageId: "NEW" },
      ],
      positions: [{ id: "p1", jobId: "j1", status: "FILLED", filledAt: day(1) }],
    }),
    "30d",
    NOW
  );
  assert.deepEqual(r.byJob, [{ jobId: "j1", title: "Auxiliar de Logística", received: 2, hired: 1, filled: 1, medianDaysToFill: null }]);
});
