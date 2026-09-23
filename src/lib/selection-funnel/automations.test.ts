import { test } from "node:test";
import assert from "node:assert/strict";
import { automationsFor, isAutomationOn, parseAutomations } from "./automations";

test("admissão abre o cadastro por padrão (comportamento anterior preservado)", () => {
  assert.equal(isAutomationOn({ kind: "ADMISSION", automations: {} }, "openAdmission"), true);
  assert.equal(isAutomationOn({ kind: "WON", automations: null }, "openAdmission"), true);
});

test("a automação desligada explicitamente é respeitada", () => {
  assert.equal(isAutomationOn({ kind: "WON", automations: { openAdmission: false } }, "openAdmission"), false);
});

test("automação não vale para outro tipo de etapa", () => {
  assert.equal(isAutomationOn({ kind: "OPEN", automations: { openAdmission: true } }, "openAdmission"), false);
  assert.equal(isAutomationOn({ kind: "LOST", automations: { createTestLink: true } }, "createTestLink"), false);
});

test("link do teste exige teste vinculado e é desligado por padrão", () => {
  assert.equal(isAutomationOn({ kind: "TEST", templateId: "t1", automations: {} }, "createTestLink"), false);
  assert.equal(isAutomationOn({ kind: "TEST", templateId: null, automations: { createTestLink: true } }, "createTestLink"), false);
  assert.equal(isAutomationOn({ kind: "TEST", templateId: "t1", automations: { createTestLink: true } }, "createTestLink"), true);
});

test("parseAutomations ignora chaves desconhecidas e valores inválidos", () => {
  assert.deepEqual(parseAutomations({ openAdmission: "sim", foo: true, createTestLink: true }), { createTestLink: true });
  assert.deepEqual(parseAutomations("x"), {});
});

test("automationsFor lista só as ações do tipo", () => {
  assert.deepEqual(automationsFor("TEST").map((a) => a.key), ["createTestLink"]);
  assert.deepEqual(automationsFor("OPEN"), []);
});
