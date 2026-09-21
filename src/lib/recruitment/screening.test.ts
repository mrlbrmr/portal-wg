import { test } from "node:test";
import assert from "node:assert/strict";
import { extractScreeningCriteria } from "./screening";

test("lê a seção de requisitos obrigatórios da descrição (formato do JobForm)", () => {
  const description =
    "<p>Vaga para o time comercial.</p>" +
    "<h2>Responsabilidades</h2><ul><li>Atender clientes</li></ul>" +
    "<h2>Requisitos Obrigatórios</h2><ul><li>Ensino médio completo</li><li><strong>Experiência</strong> comercial</li></ul>" +
    "<h2>Requisitos Desejáveis</h2><ul><li>Inglês</li></ul>";
  assert.deepEqual(extractScreeningCriteria({ description }), [
    "Ensino médio completo",
    "Experiência comercial",
  ]);
});

test("ignora seções de requisitos desejáveis/diferenciais", () => {
  const description = "<h2>Diferenciais</h2><ul><li>CNH B</li></ul><h2>Requisitos desejáveis</h2><ul><li>Excel</li></ul>";
  assert.deepEqual(extractScreeningCriteria({ description }), []);
});

test("vaga legada: usa requiredRequirements (lista ou parágrafos)", () => {
  assert.deepEqual(
    extractScreeningCriteria({ requiredRequirements: "<ul><li>CNH B</li><li>CNH B</li><li>Disponibilidade &amp; viagens</li></ul>" }),
    ["CNH B", "Disponibilidade & viagens"]
  );
  assert.deepEqual(
    extractScreeningCriteria({ requiredRequirements: "<p>Ensino médio</p><p>Experiência com vendas</p>" }),
    ["Ensino médio", "Experiência com vendas"]
  );
});

test("sem requisitos: lista vazia (nunca inventa critérios)", () => {
  assert.deepEqual(extractScreeningCriteria({ description: "<p>Descrição livre.</p>" }), []);
  assert.deepEqual(extractScreeningCriteria({}), []);
});
