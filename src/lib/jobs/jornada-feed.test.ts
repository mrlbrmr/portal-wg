import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFunnel,
  buildJornadaFeed,
  funnelAnchors,
  jobInScope,
  parseSince,
  type AdmissionRow,
  type ApplicationRow,
  type JobRow,
  type PositionRow,
  type StageHistoryRow,
  type StageRow,
} from "./jornada-feed";

// Pipeline real (migração 20260812000001): ids legados + etapas novas com uuid.
const stages: StageRow[] = [
  { id: "NEW", name: "Novas candidaturas", sortOrder: 10, kind: "OPEN" },
  { id: "SCREENING", name: "Triagem", sortOrder: 20, kind: "OPEN" },
  { id: "t1", name: "Teste de personalidade", sortOrder: 30, kind: "TEST" },
  { id: "t2", name: "Teste técnico/Excel", sortOrder: 40, kind: "TEST" },
  { id: "INTERVIEW", name: "Entrevista G&G", sortOrder: 50, kind: "OPEN" },
  { id: "OFFER", name: "Entrevista Gestor", sortOrder: 60, kind: "OPEN" },
  { id: "adm", name: "Admissão", sortOrder: 70, kind: "ADMISSION" },
  { id: "HIRED", name: "Finalizada", sortOrder: 80, kind: "WON" },
  { id: "REJECTED", name: "Cancelada", sortOrder: 90, kind: "LOST", hideFromBoard: true },
  { id: "pause", name: "Pausada", sortOrder: 100, kind: "OPEN", hideFromBoard: true },
];

const job: JobRow = {
  id: "job-1", code: "VAG-2026-0031", title: "Auxiliar de Logística", department: "Logística",
  company: "WG Baterias", city: "Sumaré", state: "SP", status: "FILLED", hiringManager: "Carlos Henrique",
  responsible: "Murilo", openingReason: "REPLACEMENT", contractType: "CLT", workSchedule: null, salary: "2100.00",
  isTalentPool: false, createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-30T12:00:00Z",
};

const app = (id: string, stageId: string, source = "PORTAL", createdAt = "2026-09-02T10:00:00Z"): ApplicationRow =>
  ({ id, jobId: "job-1", stageId, source, createdAt });
const h = (applicationId: string, stageId: string, changedAt: string): StageHistoryRow => ({ applicationId, stageId, changedAt });

const apps = [
  app("a1", "NEW"),
  app("a2", "REJECTED", "CATHO"), // reprovado depois da entrevista G&G
  app("a3", "pause"), // pausado depois da triagem
  app("a4", "HIRED", "INTERNAL_REFERRAL", "2026-09-03T10:00:00Z"),
  app("a5", "OFFER", "PORTAL", "2026-09-04T10:00:00Z"), // pulou a triagem no quadro
];
const history = [
  h("a2", "SCREENING", "2026-09-05T10:00:00Z"),
  h("a2", "INTERVIEW", "2026-09-08T10:00:00Z"),
  h("a2", "REJECTED", "2026-09-09T10:00:00Z"),
  h("a3", "SCREENING", "2026-09-06T10:00:00Z"),
  h("a3", "pause", "2026-09-07T10:00:00Z"),
  h("a4", "SCREENING", "2026-09-04T10:00:00Z"),
  h("a4", "INTERVIEW", "2026-09-10T10:00:00Z"),
  h("a4", "OFFER", "2026-09-15T10:00:00Z"),
  h("a4", "adm", "2026-09-20T10:00:00Z"),
  h("a4", "HIRED", "2026-09-30T10:00:00Z"),
  h("a5", "OFFER", "2026-09-12T10:00:00Z"),
];
const positions: PositionRow[] = [
  { jobId: "job-1", positionNumber: 1, status: "FILLED", applicationId: "a4", admissionId: "adm-1", candidateName: "Ana Souza",
    expectedStartDate: "2026-10-05", filledAt: "2026-09-20T10:00:00Z", cancelledAt: null, cancelReason: null },
  { jobId: "job-1", positionNumber: 2, status: "CANCELLED", applicationId: null, admissionId: null, candidateName: null,
    expectedStartDate: null, filledAt: null, cancelledAt: "2026-09-25T10:00:00Z", cancelReason: "Quadro revisto" },
];

test("âncoras do funil pelos ids estáveis e pela 1ª etapa de admissão", () => {
  assert.deepEqual(funnelAnchors(stages), { triagem: 20, entrevistaRH: 50, entrevistaGestor: 60, aprovados: 70 });
});

test("âncoras caem no nome quando a etapa foi recriada com outro id", () => {
  const custom: StageRow[] = [
    { id: "x1", name: "Triagem de CV", sortOrder: 1, kind: "OPEN" },
    { id: "x2", name: "Entrevista RH", sortOrder: 2, kind: "OPEN" },
    { id: "x3", name: "Entrevista com gestor", sortOrder: 3, kind: "OPEN" },
    { id: "x4", name: "Contratado", sortOrder: 4, kind: "WON" },
  ];
  assert.deepEqual(funnelAnchors(custom), { triagem: 1, entrevistaRH: 2, entrevistaGestor: 3, aprovados: 4 });
});

test("funil conta quem CHEGOU até a etapa, mesmo reprovado ou pausado depois", () => {
  const { funnel } = buildFunnel("job-1", apps, history, positions, stages);
  assert.deepEqual(funnel, {
    inscritos: 5,
    triagem: 4, // a2, a3, a4, a5 (a5 pulou a triagem, mas o funil é cumulativo)
    entrevistaRH: 3, // a2, a4, a5 (cumulativo a partir da entrevista com o gestor)
    entrevistaGestor: 2, // a4, a5
    aprovados: 1, // a4
    reprovados: 1,
    contratados: 1,
  });
});

test("Pausada e Cancelada (ocultas/LOST) não contam como avanço, apesar da ordem alta", () => {
  const { funnel } = buildFunnel("job-1", [app("p", "pause")], [], [], stages);
  assert.equal(funnel.aprovados, 0);
  assert.equal(funnel.triagem, 0);
});

test("primeira chegada a cada etapa e origem das candidaturas", () => {
  const { firstReachedAt, sources } = buildFunnel("job-1", apps, history, positions, stages);
  assert.equal(firstReachedAt.inscritos, "2026-09-02T10:00:00Z");
  assert.equal(firstReachedAt.triagem, "2026-09-04T10:00:00Z");
  assert.equal(firstReachedAt.entrevistaRH, "2026-09-08T10:00:00Z");
  assert.equal(firstReachedAt.entrevistaGestor, "2026-09-12T10:00:00Z");
  assert.equal(firstReachedAt.aprovados, "2026-09-20T10:00:00Z");
  assert.deepEqual(sources, { Portal: 3, Catho: 1, "Indicação": 1 });
});

test("posição preenchida conta como aprovada mesmo sem passar pela etapa no quadro", () => {
  const { funnel } = buildFunnel("job-1", [app("z", "OFFER")], [], [{ ...positions[0], applicationId: "z" }], stages);
  assert.equal(funnel.aprovados, 1);
});

test("escopo: vagas abertas sempre; encerradas só a partir do corte; banco de talentos nunca", () => {
  assert.equal(jobInScope({ status: "ACTIVE", createdAt: "2025-03-01T00:00:00Z", isTalentPool: false }, "2026-01-01"), true);
  assert.equal(jobInScope({ status: "PAUSED", createdAt: "2025-03-01T00:00:00Z", isTalentPool: false }, "2026-01-01"), true);
  assert.equal(jobInScope({ status: "FILLED", createdAt: "2025-03-01T00:00:00Z", isTalentPool: false }, "2026-01-01"), false);
  assert.equal(jobInScope({ status: "CLOSED", createdAt: "2026-02-01T00:00:00Z", isTalentPool: false }, "2026-01-01"), true);
  assert.equal(jobInScope({ status: "ACTIVE", createdAt: "2026-02-01T00:00:00Z", isTalentPool: true }, "2026-01-01"), false);
});

test("desde inválido cai no 1º de janeiro do ano", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(parseSince("2026-08-01", now), "2026-08-01");
  assert.equal(parseSince("ontem", now), "2026-01-01");
  assert.equal(parseSince(null, now), "2026-01-01");
});

const admission: AdmissionRow = {
  id: "adm-1", fullName: "Ana Souza", cpf: "123.456.789-09", birthDate: "1999-01-02", startDate: "2026-10-05",
  salary: 2100, shift: "Comercial", managerName: "Carlos Henrique", sourceApplicationId: "a4", sourceJobId: "job-1",
  createdAt: "2026-09-20T10:00:00Z", deletedAt: null,
  branch: { name: "Sumaré" }, company: [{ name: "WG Baterias Campinas" }], position: { name: "Auxiliar de Logística" },
  stage: { name: "Concluída", isFinal: true },
};

test("feed completo: vaga encerrada com posições, funil, motivo legível e contratado ligado", () => {
  const feed = buildJornadaFeed({
    since: "2026-01-01", now: new Date("2026-10-08T12:00:00Z"),
    jobs: [job, { ...job, id: "tp", isTalentPool: true }],
    stages,
    statusHistory: [
      { jobId: "job-1", status: "DRAFT", changedAt: "2026-09-01T12:00:00Z" },
      { jobId: "job-1", status: "SCREENING", changedAt: "2026-09-02T09:00:00Z" },
      { jobId: "job-1", status: "FILLED", changedAt: "2026-09-30T12:00:00Z" },
    ],
    positions, apps, stageHistory: history,
    admissions: [admission, { ...admission, id: "adm-del", deletedAt: "2026-09-21T00:00:00Z" }],
  });
  assert.equal(feed.version, 1);
  assert.equal(feed.jobs.length, 1);
  const j = feed.jobs[0];
  assert.equal(j.status, "FILLED");
  assert.equal(j.openedAt, "2026-09-02T09:00:00Z");
  assert.equal(j.closedAt, "2026-09-30T12:00:00Z");
  assert.equal(j.openingReason, "Substituição");
  assert.equal(j.salary, 2100);
  assert.deepEqual(j.statusHistory.map((s) => s.status), ["DRAFT", "ACTIVE", "FILLED"]);
  assert.equal(j.positions.length, 2);
  assert.equal(feed.hires.length, 1);
  const hire = feed.hires[0];
  assert.equal(hire.cpf, "12345678909");
  assert.equal(hire.jobCode, "VAG-2026-0031");
  assert.equal(hire.positionNumber, 1);
  assert.equal(hire.company, "WG Baterias Campinas");
  assert.equal(hire.source, "Indicação");
  assert.equal(hire.admissionFinished, true);
});

test("feed não leva dado pessoal de candidato não contratado", () => {
  const feed = buildJornadaFeed({ since: "2026-01-01", jobs: [job], stages, statusHistory: [], positions, apps, stageHistory: history, admissions: [] });
  const txt = JSON.stringify(feed);
  for (const id of ["a1", "a2", "a3", "a5"]) assert.ok(!txt.includes(`"${id}"`), `candidatura ${id} vazou`);
});
