import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBRL, salaryColumns, salaryStateFromJob } from "./salary";
import { approvedFields, approvedHint, scopeDivergences, scopeFieldsBeingChanged, type ScopeCurrent } from "./approved-scope";
import { deadlineView, formatStoredDate } from "./deadlines";
import { diffJobFields } from "./field-changes";
import { buildJobHistory, positionHistory, type JobEventRow } from "./history";

// ── Remuneração ───────────────────────────────────────────────────────────────────────

test("salário definido e divulgado → portal mostra o valor", () => {
  const cols = salaryColumns({ mode: "DEFINED", salary: 2800, salaryPublic: true, legacyText: null });
  assert.deepEqual(cols, { salary: 2800, salaryPublic: true, salaryRange: "R$ 2.800,00" });
});

test("salário interno definido, mas não divulgado → portal não mostra", () => {
  const cols = salaryColumns({ mode: "DEFINED", salary: 2800, salaryPublic: false, legacyText: null });
  assert.deepEqual(cols, { salary: 2800, salaryPublic: false, salaryRange: null });
});

test("a combinar → portal mostra 'A combinar' (ou nada, se não divulgado)", () => {
  assert.equal(salaryColumns({ mode: "TO_AGREE", salary: 3000, salaryPublic: true, legacyText: null }).salaryRange, "A combinar");
  assert.equal(salaryColumns({ mode: "TO_AGREE", salary: 3000, salaryPublic: true, legacyText: null }).salary, null);
  assert.equal(salaryColumns({ mode: "TO_AGREE", salary: null, salaryPublic: false, legacyText: null }).salaryRange, null);
});

test("compatibilidade: modelo antigo é lido corretamente", () => {
  assert.equal(salaryStateFromJob({ salary: null, salaryRange: "A combinar" }).mode, "TO_AGREE");
  assert.deepEqual(salaryStateFromJob({ salary: "2500.00", salaryRange: null }), {
    mode: "DEFINED",
    salary: 2500,
    salaryPublic: true,
    legacyText: null,
  });
  const legacy = salaryStateFromJob({ salary: null, salaryRange: "R$ 2.500 – R$ 3.000" });
  assert.equal(legacy.legacyText, "R$ 2.500 – R$ 3.000");
  // Sem valor novo, o texto antigo é preservado.
  assert.equal(salaryColumns(legacy).salaryRange, "R$ 2.500 – R$ 3.000");
});

test("formatBRL sem espaço rígido (feeds XML)", () => {
  assert.equal(formatBRL(1234.5), "R$ 1.234,50");
});

// ── Escopo aprovado ───────────────────────────────────────────────────────────────────

const scope = {
  requestCode: "REQ-2026-0005",
  title: "Motorista de Caminhão",
  location: "Nova Iguaçu",
  openings: 2,
  contractType: "CLT",
  reasonType: "REPLACEMENT",
  requesterName: "Paulo Roberto",
};
const current: ScopeCurrent = {
  title: "Motorista de Caminhão",
  department: null,
  company: "Nova Iguaçu",
  openings: 2,
  contractType: "CLT",
  modality: "PRESENTIAL",
  openingReason: "REPLACEMENT",
  hiringManager: "Paulo Roberto",
  salary: null,
};

test("sem alteração → nenhuma divergência (nada é exibido)", () => {
  assert.deepEqual(scopeDivergences(scope, current), []);
  assert.equal(approvedHint(scope, "openings", 2), null);
});

test("3 posições com 2 aprovadas → 'Originalmente aprovado: 2 posições'", () => {
  const d = scopeDivergences(scope, { ...current, openings: 3 });
  assert.equal(d.length, 1);
  assert.equal(d[0].approved, "2 posições");
  assert.equal(d[0].current, "3 posições");
  assert.equal(approvedHint(scope, "openings", 3), "Originalmente aprovado: 2 posições");
});

test("campos que a solicitação não definiu não são marcados nem comparados", () => {
  const marked = approvedFields(scope);
  assert.ok(marked.has("openings") && marked.has("title"));
  assert.ok(!marked.has("department") && !marked.has("modality") && !marked.has("salary"));
  assert.deepEqual(scopeDivergences(scope, { ...current, department: "Logística" }), []);
});

test("aviso antes de salvar lista só campos de escopo alterados", () => {
  assert.deepEqual(
    scopeFieldsBeingChanged(scope, current, { title: "Motorista", department: "Frota", contractType: "CLT" }),
    ["title"]
  );
  assert.deepEqual(scopeFieldsBeingChanged(null, current, { title: "Outro" }), []);
});

// ── Prazos ────────────────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-23T15:00:00-03:00");

test("prazos em dias de calendário (São Paulo)", () => {
  assert.equal(deadlineView("2026-10-15T00:00:00.000Z", NOW)?.label, "22 dias restantes");
  assert.equal(deadlineView("2026-09-24T00:00:00.000Z", NOW)?.label, "Vence amanhã");
  assert.equal(deadlineView("2026-09-23T00:00:00.000Z", NOW)?.label, "Vence hoje");
  const late = deadlineView("2026-09-20T00:00:00.000Z", NOW);
  assert.equal(late?.label, "Prazo vencido há 3 dias");
  assert.equal(late?.tone, "danger");
  assert.equal(deadlineView(null, NOW), null);
});

test("data só-dia não desloca pelo fuso", () => {
  assert.equal(formatStoredDate("2026-09-30T00:00:00+00:00"), "30/09/2026");
});

// ── Alterações de campos ──────────────────────────────────────────────────────────────

test("diff registra só o que mudou, com valor anterior e novo", () => {
  const changes = diffJobFields(
    { title: "A", hiringDeadline: "2026-10-01T00:00:00+00:00", salary: "2800.00", description: "x", status: "ACTIVE" },
    { title: "A", hiringDeadline: "2026-10-15", salary: 3000, description: "y", status: "PAUSED" }
  );
  assert.deepEqual(
    changes.map((c) => [c.field, c.from, c.to]),
    [
      ["salary", "R$ 2.800,00", "R$ 3.000,00"],
      ["hiringDeadline", "01/10/2026", "15/10/2026"],
      ["description", null, null],
    ]
  );
});

// ── Linha do tempo ────────────────────────────────────────────────────────────────────

const ev = (id: string, type: string, createdAt: string, data: Record<string, unknown>, extra: Partial<JobEventRow> = {}): JobEventRow => ({
  id,
  type,
  positionId: null,
  reason: null,
  data,
  actorName: "Murilo Bremer",
  createdAt,
  ...extra,
});

test("cenário 10 — criação a partir da REQ + publicação + posições, mais recente primeiro", () => {
  const items = buildJobHistory({
    createdAt: "2026-09-10T19:32:00Z",
    statusHistory: [
      { id: "1", status: "DRAFT", changedBy: "Murilo Bremer", changedAt: "2026-09-10T19:32:00Z" },
      { id: "2", status: "ACTIVE", changedBy: "Murilo Bremer", changedAt: "2026-09-11T17:50:00Z" },
      { id: "3", status: "INTERVIEW", changedBy: "Murilo Bremer", changedAt: "2026-09-21T20:40:00Z" },
    ],
    events: [
      ev("a", "JOB_CREATED", "2026-09-10T19:32:00Z", { requestCode: "REQ-2026-0005", positions: 2 }),
      ev("b", "POSITION_FILLED", "2026-09-20T13:25:00Z", { number: 1, candidateName: "João da Silva" }, { positionId: "p1" }),
    ],
  });
  assert.deepEqual(
    items.map((i) => i.title),
    ["Status alterado", "Posição #01 preenchida", "Vaga publicada", "Vaga criada"]
  );
  assert.deepEqual(items[0].details, ["Recebendo candidaturas → Entrevistas"]);
  assert.ok(items[3].details.includes("Originada da REQ-2026-0005"));
});

test("vaga antiga sem evento de criação usa o primeiro status", () => {
  const items = buildJobHistory({
    createdAt: "2026-01-01T00:00:00Z",
    statusHistory: [{ id: "1", status: "ACTIVE", changedBy: "Ana", changedAt: "2026-01-01T00:00:00Z" }],
    events: [],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "created");
});

test("histórico da posição preserva a desistência", () => {
  const events = [
    ev("f", "POSITION_FILLED", "2026-09-20T10:00:00Z", { number: 1, candidateName: "João da Silva" }, { positionId: "p1" }),
    ev("r", "POSITION_RELEASED", "2026-09-22T10:00:00Z", { number: 1, candidateName: "João da Silva" }, { positionId: "p1", reason: "Desistência" }),
    ev("o", "POSITION_ADDED", "2026-09-22T11:00:00Z", { number: 3, from: 2, to: 3 }, { positionId: "p3" }),
  ];
  const h = positionHistory(events, "p1");
  assert.equal(h.length, 2);
  assert.equal(h[0].kind, "position_released");
  assert.deepEqual(h[0].details, ["João da Silva", "Motivo: Desistência"]);
  const added = buildJobHistory({ createdAt: events[0].createdAt, statusHistory: [], events }).find((i) => i.kind === "position_added");
  assert.deepEqual(added?.details, ["Quantidade de posições alterada de 2 para 3"]);
});
