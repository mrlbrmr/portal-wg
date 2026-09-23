// Testes dos Relatórios de Admissões (reports.ts): recorte, comparação honesta e alertas.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attentionItems,
  monthlySeries,
  parseReportFilters,
  periodWindow,
  summarizeReport,
  EMPTY_REPORT_FILTERS,
  type ReportAdmission,
} from "./reports";

const NOW = new Date(2026, 8, 23, 12, 0, 0); // 23/09/2026

function row(over: Partial<ReportAdmission> = {}): ReportAdmission {
  return {
    id: Math.random().toString(36).slice(2),
    fullName: "Fulano",
    createdAt: new Date(2026, 8, 10).toISOString(),
    companyId: "c1",
    companyName: "WG",
    branchId: "b1",
    branchName: "Matriz",
    positionId: "p1",
    positionName: "Motorista",
    responsibleId: "u1",
    stageId: "s1",
    stageName: "Documentos",
    stageColor: "#999",
    isFinal: false,
    startDate: null,
    examDate: null,
    digitalFormToken: false,
    digitalFormExpiresAt: null,
    digitalFormSubmittedAt: null,
    requiredDocsTotal: 3,
    requiredDocsDone: 3,
    docsToReview: 0,
    ...over,
  };
}

describe("filtros e período", () => {
  it("ignora valores inválidos da URL", () => {
    const f = parseReportFilters({ periodo: "xyz", empresa: "abc'; drop", status: "ativas" });
    assert.equal(f.period, "tudo");
    assert.equal(f.company, "");
    assert.equal(f.status, "ativas");
  });

  it("30 dias inclui hoje e a janela anterior tem o mesmo tamanho", () => {
    const w = periodWindow("30d", NOW);
    assert.equal(w.from?.getDate(), 25); // 25/08
    assert.equal((w.prevTo!.getTime() - w.prevFrom!.getTime()) / 86_400_000, 30);
  });
});

describe("comparação com período anterior", () => {
  it("não compara quando o sistema não tinha dados em toda a janela anterior", () => {
    const rows = [row({ createdAt: new Date(2026, 7, 20).toISOString() }), row()];
    const s = summarizeReport(rows, { ...EMPTY_REPORT_FILTERS, period: "30d" }, NOW);
    assert.equal(s.createdDeltaPct, null);
  });

  it("calcula a variação quando há base completa", () => {
    const rows = [
      row({ createdAt: new Date(2026, 5, 1).toISOString() }), // dado antigo: cobre a janela anterior
      row({ createdAt: new Date(2026, 7, 10).toISOString() }), // anterior
      row({ createdAt: new Date(2026, 7, 12).toISOString() }), // anterior
      row(), // atual
      row(), // atual
      row(), // atual
    ];
    const s = summarizeReport(rows, { ...EMPTY_REPORT_FILTERS, period: "30d" }, NOW);
    assert.equal(s.created, 3);
    assert.equal(s.createdDeltaPct, 50);
  });
});

describe("atenção necessária", () => {
  it("só gera alertas com fatos e ignora admissões concluídas", () => {
    const rows = [
      row({ startDate: "2026-09-20" }), // início vencido, sem ASO
      row({ startDate: "2026-09-25", requiredDocsDone: 1, examDate: "2026-09-24" }), // começa em 2 dias, docs incompletos
      row({ docsToReview: 2 }),
      row({ digitalFormToken: true, digitalFormExpiresAt: new Date(2026, 8, 25).toISOString() }), // enviado dia 18 → 5 dias
      row({ isFinal: true, startDate: "2026-09-01" }),
    ];
    const items = attentionItems(rows, NOW);
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.count]));
    assert.deepEqual(byKey, { late: 1, "soon-incomplete": 1, "soon-no-exam": 1, "docs-review": 1, "form-waiting": 1 });
    const s = summarizeReport(rows, EMPTY_REPORT_FILTERS, NOW);
    assert.equal(s.activeWithIssues, 4);
    assert.equal(s.completed, 1);
  });

  it("não gera nada quando está tudo em dia", () => {
    assert.equal(attentionItems([row({ startDate: "2026-12-01", examDate: "2026-11-20" })], NOW).length, 0);
  });
});

describe("série mensal", () => {
  it("mostra ao menos 6 meses e conta por mês de abertura", () => {
    const m = monthlySeries([row(), row({ createdAt: new Date(2026, 6, 3).toISOString() })], EMPTY_REPORT_FILTERS, NOW);
    assert.equal(m.length, 6);
    assert.equal(m[m.length - 1].value, 1);
    assert.equal(m[m.length - 3].value, 1);
  });
});
