// Filial e área vindas dos cadastros: opções do select e resolução no servidor.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { missingOrgUnitsMessage, resolveOrgUnits, selectableOptions, type OrgUnit } from "./org-units";

const branches: OrgUnit[] = [
  { id: "b-sjp", name: "Matriz (SJP)", active: true, city: "São José dos Pinhais", state: "PR" },
  { id: "b-rj", name: "Rio de Janeiro", active: true, city: "Nova Iguaçu", state: "RJ" },
  { id: "b-old", name: "Curitiba (fechada)", active: false, city: "Curitiba", state: "PR" },
];
const areas: OrgUnit[] = [
  { id: "a-log", name: "Logística", active: true },
  { id: "a-old", name: "Trade antigo", active: false },
];

describe("selectableOptions", () => {
  it("mostra só os ativos quando nada inativo está escolhido", () => {
    assert.deepEqual(selectableOptions(branches, null).map((b) => b.id), ["b-sjp", "b-rj"]);
  });
  it("mantém o item inativo que já está no registro, na ordem original", () => {
    assert.deepEqual(selectableOptions(branches, "b-old").map((b) => b.id), ["b-sjp", "b-rj", "b-old"]);
  });
});

describe("resolveOrgUnits", () => {
  it("envio novo: grava ids e copia nome, cidade e UF da filial", () => {
    const r = resolveOrgUnits({ branchId: "b-rj", areaId: "a-log" }, branches, areas, { requireIds: true });
    assert.deepEqual(r, {
      ok: true, branchId: "b-rj", areaId: "a-log", location: "Rio de Janeiro", department: "Logística",
      city: "Nova Iguaçu", state: "RJ",
    });
  });

  it("envio novo sem filial ou sem área: erro no campo", () => {
    assert.deepEqual(resolveOrgUnits({ areaId: "a-log" }, branches, areas, { requireIds: true }),
      { ok: false, field: "branchId", message: "Escolha a filial." });
    assert.deepEqual(resolveOrgUnits({ branchId: "b-sjp" }, branches, areas, { requireIds: true }),
      { ok: false, field: "areaId", message: "Escolha a área." });
  });

  it("id inexistente é recusado, nunca vira texto vazio", () => {
    assert.deepEqual(resolveOrgUnits({ branchId: "x", areaId: "a-log" }, branches, areas, { requireIds: true }),
      { ok: false, field: "branchId", message: "Filial não encontrada." });
    assert.deepEqual(resolveOrgUnits({ branchId: "b-sjp", areaId: "x" }, branches, areas, { requireIds: false }),
      { ok: false, field: "areaId", message: "Área não encontrada." });
  });

  it("envio novo com filial ou área desativada é recusado", () => {
    assert.deepEqual(resolveOrgUnits({ branchId: "b-old", areaId: "a-log" }, branches, areas, { requireIds: true }),
      { ok: false, field: "branchId", message: "Esta filial está desativada." });
    assert.deepEqual(resolveOrgUnits({ branchId: "b-sjp", areaId: "a-old" }, branches, areas, { requireIds: true }),
      { ok: false, field: "areaId", message: "Esta área está desativada." });
  });

  it("edição de registro que já tinha a filial desativada continua valendo", () => {
    const r = resolveOrgUnits({ branchId: "b-old", areaId: "a-old" }, branches, areas, { requireIds: false });
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.location, "Curitiba (fechada)");
  });

  it("registro antigo sem ids mantém o texto legado", () => {
    const r = resolveOrgUnits(
      { legacyLocation: "WG Baterias Maringá", legacyDepartment: "logistica" },
      branches, areas, { requireIds: false }
    );
    assert.deepEqual(r, {
      ok: true, branchId: null, areaId: null, location: "WG Baterias Maringá", department: "logistica",
      city: null, state: null,
    });
  });
});

describe("missingOrgUnitsMessage (envio do rascunho exige filial e área)", () => {
  it("rascunho sem filial ou sem área não pode seguir", () => {
    assert.equal(
      missingOrgUnitsMessage({ branchId: null, location: null, areaId: "a-log", department: "Logística" }),
      "Escolha a filial e a área antes de enviar."
    );
    assert.equal(
      missingOrgUnitsMessage({ branchId: "b-sjp", location: "Matriz (SJP)", areaId: null, department: "  " }),
      "Escolha a filial e a área antes de enviar."
    );
  });
  it("com cadastro ou com texto legado, segue", () => {
    assert.equal(missingOrgUnitsMessage({ branchId: "b-sjp", location: "Matriz (SJP)", areaId: "a-log", department: "Logística" }), null);
    assert.equal(missingOrgUnitsMessage({ branchId: null, location: "WG Baterias Maringá", areaId: null, department: "logistica" }), null);
  });
});
