import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENTRY_REQUIRED_MESSAGE,
  MIN_STAGES_MESSAGE,
  processKind,
  refsFromIds,
  removedWithCandidates,
  resolveJobStages,
  sameStageList,
  validateMoves,
  validateStageSelection,
} from "./process-templates";

const catalog = [
  { id: "NEW", name: "Novas candidaturas", sortOrder: 10, active: true },
  { id: "TRI", name: "Triagem", sortOrder: 20, active: true },
  { id: "ENT", name: "Entrevista", sortOrder: 30, active: true },
  { id: "OLD", name: "Antiga", sortOrder: 40, active: false },
  { id: "LOST", name: "Reprovado", sortOrder: 50, active: true },
];

test("sem ajuste e sem modelo padrão: catálogo ativo na ordem do catálogo", () => {
  const r = resolveJobStages(catalog, [], null);
  assert.equal(r.source, "CATALOG");
  assert.deepEqual(r.stages.map((s) => s.id), ["NEW", "TRI", "ENT", "LOST"]);
});

test("sem ajuste: segue o modelo padrão, na ordem do modelo", () => {
  const r = resolveJobStages(catalog, [], refsFromIds(["NEW", "ENT", "TRI"]));
  assert.equal(r.source, "TEMPLATE");
  assert.deepEqual(r.stages.map((s) => s.id), ["NEW", "ENT", "TRI"]);
});

test("ajuste da vaga vence o modelo padrão e respeita a ordem própria", () => {
  const r = resolveJobStages(catalog, refsFromIds(["NEW", "LOST", "TRI"]), refsFromIds(["NEW", "ENT"]));
  assert.equal(r.source, "JOB");
  assert.deepEqual(r.stages.map((s) => s.id), ["NEW", "LOST", "TRI"]);
});

test("etapa desativada ou inexistente nunca aparece", () => {
  const r = resolveJobStages(catalog, refsFromIds(["NEW", "OLD", "XXX", "TRI"]), null);
  assert.deepEqual(r.stages.map((s) => s.id), ["NEW", "TRI"]);
});

test("configuração que só tem etapas inválidas cai no padrão", () => {
  const r = resolveJobStages(catalog, refsFromIds(["OLD", "XXX"]), refsFromIds(["NEW", "TRI"]));
  assert.equal(r.source, "TEMPLATE");
});

test("linhas legadas sem sortOrder mantêm a ordem em que vieram", () => {
  const r = resolveJobStages(catalog, [{ stageId: "ENT" }, { stageId: "NEW" }, { stageId: "TRI" }], null);
  assert.deepEqual(r.stages.map((s) => s.id), ["ENT", "NEW", "TRI"]);
});

test("validação: exige etapa de entrada, 2+ etapas, sem repetição e só ativas", () => {
  assert.equal(validateStageSelection(["NEW", "TRI"], catalog), null);
  assert.equal(validateStageSelection(["TRI", "ENT"], catalog), ENTRY_REQUIRED_MESSAGE);
  assert.equal(validateStageSelection(["NEW"], catalog), MIN_STAGES_MESSAGE);
  assert.match(validateStageSelection(["NEW", "NEW"], catalog) ?? "", /repetidas/);
  assert.match(validateStageSelection(["NEW", "OLD"], catalog) ?? "", /desativada/);
  assert.match(validateStageSelection(["NEW", "XXX"], catalog) ?? "", /não existe/);
});

test("etapas removidas só pedem destino quando têm candidatos", () => {
  const removed = removedWithCandidates(["NEW", "TRI", "ENT"], ["NEW"], { TRI: 2, ENT: 0 }, catalog);
  assert.deepEqual(removed, [{ stageId: "TRI", name: "Triagem", candidates: 2 }]);
  assert.deepEqual(removedWithCandidates(["NEW", "TRI"], ["NEW", "TRI"], { TRI: 5 }, catalog), []);
});

test("destino dos candidatos: obrigatório e dentro do processo", () => {
  const removed = [{ stageId: "TRI", name: "Triagem", candidates: 2 }];
  assert.match(validateMoves(removed, {}, ["NEW"]) ?? "", /Escolha para onde/);
  assert.match(validateMoves(removed, { TRI: "ENT" }, ["NEW"]) ?? "", /continuar no processo/);
  assert.equal(validateMoves(removed, { TRI: "NEW" }, ["NEW"]), null);
  assert.equal(validateMoves([], null, ["NEW"]), null);
});

test("estado do processo da vaga", () => {
  assert.equal(sameStageList(["a", "b"], ["a", "b"]), true);
  assert.equal(sameStageList(["a", "b"], ["b", "a"]), false);
  assert.equal(processKind({ source: "TEMPLATE", jobIds: [], templateIds: null }), "DEFAULT");
  assert.equal(processKind({ source: "CATALOG", jobIds: [], templateIds: null }), "DEFAULT");
  assert.equal(processKind({ source: "JOB", jobIds: ["a", "b"], templateIds: ["a", "b"] }), "TEMPLATE");
  assert.equal(processKind({ source: "JOB", jobIds: ["a", "c"], templateIds: ["a", "b"] }), "ADJUSTED");
  assert.equal(processKind({ source: "JOB", jobIds: ["a", "c"], templateIds: null }), "CUSTOM");
});
