// Testes dos eventos do Calendário de RH (calendar.ts) — só datas reais, nada inventado.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCalendarEvents,
  filterCalendarEvents,
  monthGrid,
  summarizeEvents,
  weekStart,
  EMPTY_CALENDAR_FILTERS,
  type CalendarAdmission,
} from "./calendar";

function adm(over: Partial<CalendarAdmission> = {}): CalendarAdmission {
  return {
    id: "a1",
    fullName: "Diogo dos Santos",
    startDate: null,
    examDate: null,
    birthDate: null,
    positionName: "Motorista",
    companyId: "c1",
    companyName: "WG",
    branchId: "b1",
    branchName: "Matriz",
    responsibleId: "u1",
    responsibleName: "Murilo",
    stageName: "Agendamento de ASO",
    stageColor: "#999",
    isFinal: false,
    digitalFormToken: false,
    digitalFormExpiresAt: null,
    digitalFormSubmittedAt: null,
    ...over,
  };
}

const SEP = { from: "2026-09-01", to: "2026-09-30" };

describe("buildCalendarEvents", () => {
  it("gera início e exame só dentro do intervalo, com status relativo a hoje", () => {
    const evs = buildCalendarEvents(
      [adm({ startDate: "2026-09-25", examDate: "2026-09-20" }), adm({ id: "a2", startDate: "2026-10-02" })],
      SEP,
      "2026-09-23"
    );
    assert.deepEqual(evs.map((e) => `${e.kind}:${e.date}:${e.status.label}`), ["exam:2026-09-20:Data passada", "start:2026-09-25:Agendado"]);
  });

  it("repete aniversário no ano do intervalo e trata 29/02", () => {
    const [b] = buildCalendarEvents([adm({ birthDate: "1990-09-23" })], SEP, "2026-09-23");
    assert.equal(b.date, "2026-09-23");
    assert.equal(b.note, "Completa 36 anos");
    assert.equal(b.status.label, "Hoje");
    const leap = buildCalendarEvents([adm({ birthDate: "2000-02-29" })], { from: "2027-02-01", to: "2027-02-28" }, "2027-01-01");
    assert.equal(leap[0]?.date, "2027-02-28");
  });

  it("prazo do formulário só aparece enquanto o candidato não preencheu", () => {
    const pending = adm({ digitalFormToken: true, digitalFormExpiresAt: "2026-09-26T15:00:00.000Z" });
    assert.equal(buildCalendarEvents([pending], SEP, "2026-09-23")[0]?.kind, "deadline");
    const done = { ...pending, digitalFormSubmittedAt: "2026-09-24T10:00:00.000Z" };
    assert.equal(buildCalendarEvents([done], SEP, "2026-09-23").length, 0);
  });

  it("não inventa vencimento de experiência sem política definida", () => {
    const evs = buildCalendarEvents([adm({ startDate: "2026-07-01" })], { from: "2026-07-01", to: "2026-12-31" }, "2026-09-23");
    assert.equal(evs.filter((e) => e.kind === "experience").length, 0);
  });
});

describe("filtros e resumo", () => {
  const evs = buildCalendarEvents(
    [
      adm({ startDate: "2026-09-23", examDate: "2026-09-23" }),
      adm({ id: "a2", companyId: "c2", branchId: "b2", responsibleId: null, startDate: "2026-09-23" }),
    ],
    SEP,
    "2026-09-23"
  );

  it("filtra por empresa, tipo e responsável (inclusive sem responsável)", () => {
    assert.equal(filterCalendarEvents(evs, { ...EMPTY_CALENDAR_FILTERS, company: "c2" }).length, 1);
    assert.equal(filterCalendarEvents(evs, { ...EMPTY_CALENDAR_FILTERS, kind: "exam" }).length, 1);
    assert.equal(filterCalendarEvents(evs, { ...EMPTY_CALENDAR_FILTERS, responsible: "none" }).length, 1);
  });

  it("resume só os tipos presentes, no singular/plural", () => {
    assert.equal(summarizeEvents(evs), "2 inícios · 1 exame médico");
  });
});

describe("grade", () => {
  it("setembro/2026 começa no domingo 30/08 e fecha semanas completas", () => {
    const g = monthGrid(2026, 8);
    assert.equal(g[0][0], "2026-08-30");
    assert.ok(g.every((w) => w.length === 7));
    assert.equal(g[g.length - 1][6], "2026-10-03");
  });

  it("weekStart volta ao domingo", () => {
    assert.equal(weekStart("2026-09-23"), "2026-09-20");
  });
});
