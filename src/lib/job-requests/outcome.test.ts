import { test } from "node:test";
import assert from "node:assert/strict";
import { displayStatusLabel, isConcludedRequest, requestDisplayStatus } from "./outcome";

test("em recrutamento vira desfecho pela vaga ligada", () => {
  assert.equal(requestDisplayStatus("RECRUITING", "FILLED"), "FULFILLED");
  assert.equal(requestDisplayStatus("RECRUITING", "CLOSED"), "CLOSED_UNFILLED");
  assert.equal(requestDisplayStatus("RECRUITING", "ACTIVE"), "RECRUITING");
  assert.equal(requestDisplayStatus("RECRUITING", "SCREENING"), "RECRUITING"); // etapa legada = aberta
  assert.equal(requestDisplayStatus("RECRUITING", "PAUSED"), "RECRUITING");
  assert.equal(requestDisplayStatus("RECRUITING", null), "RECRUITING");
});

test("antes do recrutamento o status do workflow é o que vale", () => {
  assert.equal(requestDisplayStatus("PENDING_HR", "FILLED"), "PENDING_HR");
  assert.equal(requestDisplayStatus("APPROVED", null), "APPROVED");
  assert.equal(requestDisplayStatus("CANCELLED", "CLOSED"), "CANCELLED");
});

test("desfechos e rótulos", () => {
  assert.equal(isConcludedRequest("FULFILLED"), true);
  assert.equal(isConcludedRequest("CLOSED_UNFILLED"), true);
  assert.equal(isConcludedRequest("REJECTED"), true);
  assert.equal(isConcludedRequest("RECRUITING"), false);
  assert.equal(isConcludedRequest("PENDING_APPROVAL"), false);
  assert.equal(displayStatusLabel("FULFILLED"), "Atendida");
  assert.equal(displayStatusLabel("CLOSED_UNFILLED"), "Encerrada sem contratação");
  assert.equal(displayStatusLabel("RECRUITING"), "Em recrutamento");
});
