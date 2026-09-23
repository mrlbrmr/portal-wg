// Testes das regras puras do Banco de Talentos (crm.ts). Runner: `npm test`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_FILTERS,
  countActiveFilters,
  entryStagesFor,
  parseSort,
  parseTalentFilters,
  presetRange,
  relativeDay,
  sameFilters,
  samePhone,
  sameTagName,
  searchTerms,
  serializeTalentFilters,
  startOfMonthSaoPaulo,
} from "./crm";

describe("filtros ⇄ URL", () => {
  it("ida e volta preserva os filtros (inclusive valores com vírgula)", () => {
    const f = {
      ...EMPTY_FILTERS,
      q: "motorista",
      situacao: ["DISPONIVEL", "INDISPONIVEL"] as const,
      uf: ["PR"],
      cidade: ["São José dos Pinhais"],
      area: ["Logística, Frota"],
      tag: ["t1", "t2"],
      favorito: true,
      candidatura: "90d" as const,
    };
    const parsed = parseTalentFilters(new URLSearchParams(serializeTalentFilters({ ...f, situacao: [...f.situacao] })));
    assert.deepEqual(parsed, { ...f, situacao: [...f.situacao] });
  });

  it("descarta valores inválidos em vez de quebrar a consulta", () => {
    const f = parseTalentFilters({ situacao: "EM_PROCESSO|QUALQUER", candidatura: "ontem", favorito: "sim" });
    assert.deepEqual(f.situacao, ["EM_PROCESSO"]);
    assert.equal(f.candidatura, "");
    assert.equal(f.favorito, false);
  });

  it("filtros vazios não geram parâmetros", () => {
    assert.deepEqual(serializeTalentFilters(EMPTY_FILTERS), {});
  });

  it("contagem ignora busca e favorito (têm controles próprios)", () => {
    const f = { ...EMPTY_FILTERS, q: "ana", favorito: true, uf: ["PR", "SC"], avaliacao: true, entrada: "mes" as const };
    assert.equal(countActiveFilters(f), 4);
  });

  it("compara filtros independentemente da ordem das chaves", () => {
    const a = parseTalentFilters({ uf: "PR", q: "x" });
    const b = parseTalentFilters({ q: "x", uf: "PR" });
    assert.ok(sameFilters(a, b));
    assert.ok(!sameFilters(a, { ...b, uf: ["SC"] }));
  });
});

describe("ordenação", () => {
  it("padrão: última atividade, mais recente primeiro", () => {
    assert.deepEqual(parseSort({}), { sort: "atividade", asc: false });
  });
  it("nome começa em A→Z e aceita inverter", () => {
    assert.deepEqual(parseSort({ ordem: "nome" }), { sort: "nome", asc: true });
    assert.deepEqual(parseSort({ ordem: "nome", dir: "desc" }), { sort: "nome", asc: false });
  });
});

describe("datas", () => {
  const now = new Date("2026-09-23T15:00:00.000Z"); // 12:00 em São Paulo

  it("hoje / ontem / data curta, no fuso de São Paulo", () => {
    assert.equal(relativeDay("2026-09-23T02:00:00.000Z", now), "Ontem"); // 22/09 23:00 em SP
    assert.equal(relativeDay("2026-09-23T12:00:00.000Z", now), "Hoje");
    assert.equal(relativeDay("2026-09-01T15:00:00.000Z", now), "1 set. 2026");
    assert.equal(relativeDay(null, now), "—");
  });

  it("início do mês às 00:00 de São Paulo", () => {
    assert.equal(startOfMonthSaoPaulo(now).toISOString(), "2026-09-01T03:00:00.000Z");
  });

  it("presets viram limites de data", () => {
    assert.equal(presetRange("30d", now).gte, "2026-08-24T15:00:00.000Z");
    assert.equal(presetRange("sem90", now).lt, "2026-06-25T15:00:00.000Z");
    assert.deepEqual(presetRange("nunca", now), { isNull: true });
  });
});

describe("busca, tags e telefone", () => {
  it("termos sem acento, sem curingas, um por palavra", () => {
    assert.deepEqual(searchTerms("  José  Motorista%_ "), ["jose", "motorista"]);
    assert.deepEqual(searchTerms("(41) 9 9999"), ["41", "9", "9999"]);
  });

  it("Excel, excel e ' EXCEL ' são a mesma tag", () => {
    assert.ok(sameTagName("Excel", " EXCEL "));
    assert.ok(sameTagName("CNH  D", "cnh d"));
    assert.ok(!sameTagName("CNH D", "CNH E"));
  });

  it("telefone igual ignora máscara e DDI", () => {
    assert.ok(samePhone("(41) 9 9999-8888", "5541999998888"));
    assert.ok(!samePhone("(41) 9 9999-8888", "(41) 9 9999-8887"));
    assert.ok(!samePhone("", ""));
  });
});

describe("etapas de entrada ao adicionar a uma vaga", () => {
  it("só etapas comuns e de teste visíveis no quadro", () => {
    const stages = [
      { id: "NEW", kind: "OPEN" },
      { id: "T", kind: "TEST" },
      { id: "ADM", kind: "ADMISSION" },
      { id: "HIRED", kind: "WON" },
      { id: "REJECTED", kind: "LOST", hideFromBoard: true },
      { id: "HIDDEN", kind: "OPEN", hideFromBoard: true },
    ];
    assert.deepEqual(entryStagesFor(stages).map((s) => s.id), ["NEW", "T"]);
  });
});
