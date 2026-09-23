// Testes do catálogo de Atividades: ordenação estável e mapeamento dos eventos reais.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activityType,
  ADMISSION_LOG_ACTIONS,
  logActionsFor,
  requestEventType,
  timestampSortKey,
  ACTIVITY_TYPES,
} from "./catalog";
import { roleLabel } from "@/lib/access/roles";

describe("timestampSortKey", () => {
  it("preserva microssegundos do Postgres e normaliza formatos", () => {
    assert.equal(timestampSortKey("2026-09-21T20:25:37.056123+00:00"), "2026-09-21T20:25:37.056123");
    assert.equal(timestampSortKey("2026-09-21T20:25:37.056Z"), "2026-09-21T20:25:37.056000");
    assert.equal(timestampSortKey("2026-09-21 20:25:37+00"), "2026-09-21T20:25:37.000000");
    assert.ok(timestampSortKey("2026-09-21T20:25:37.056123+00:00") > timestampSortKey("2026-09-21T20:25:37.056Z"));
  });

  it("converte offsets diferentes de UTC", () => {
    assert.equal(timestampSortKey("2026-09-21T17:25:37.5-03:00"), "2026-09-21T20:25:37.500000");
  });
});

describe("mapeamentos", () => {
  it("todo action do log aponta para um tipo existente", () => {
    for (const key of Object.values(ADMISSION_LOG_ACTIONS)) assert.ok(key in ACTIVITY_TYPES, key);
  });

  it("diagnósticos do bot não aparecem", () => {
    assert.ok(!logActionsFor(null).includes("GET_SESSION_ERROR"));
  });

  it("categoria filtra as ações do log", () => {
    assert.deepEqual(logActionsFor("documentos").sort(), ["DOC_APPROVED", "DOC_REJECTED", "DOC_REVIEW_UNDONE"]);
    assert.equal(logActionsFor("solicitacoes").length, 0);
  });

  it("eventos da solicitação no presente e no passado viram o mesmo tipo", () => {
    assert.equal(requestEventType("APPROVE"), "request.approved");
    assert.equal(requestEventType("APPROVED"), "request.approved");
    assert.equal(requestEventType("REJECTED"), "request.rejected");
    assert.equal(activityType(requestEventType("ALGO_NOVO")).label, "Solicitação atualizada");
  });
});

describe("perfis", () => {
  it("rótulos dos papéis existentes", () => {
    assert.equal(roleLabel("ADMIN_RH"), "Administrador RH");
    assert.equal(roleLabel("VIEWER_RH"), "Visualizador");
    assert.equal(roleLabel("DESCONHECIDO"), "Visualizador");
  });
});
