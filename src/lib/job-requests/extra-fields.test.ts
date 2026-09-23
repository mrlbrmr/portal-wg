import { test } from "node:test";
import assert from "node:assert/strict";
import type { FormFieldConfig } from "@/types/form-config";
import {
  formatExtraValue,
  isFieldVisible,
  jobRequestFormConfigSchema,
  parseMulti,
  pruneHiddenExtraData,
  serializeMulti,
  validateExtraData,
} from "./extra-fields";

const f = (p: Partial<FormFieldConfig> & Pick<FormFieldConfig, "key" | "type">): FormFieldConfig => ({
  id: p.key,
  label: p.key,
  required: false,
  ...p,
});

const turno = f({ key: "turno", type: "multiselect", options: ["Manhã", "Tarde", "Noite"] });
const cnh = f({ key: "cnh", type: "boolean" });
const categoria = f({
  key: "categoria",
  type: "select",
  options: ["C", "D", "E"],
  required: true,
  showWhen: { fieldKey: "cnh", operator: "is", value: "Sim" },
});
const adicional = f({
  key: "adicional",
  type: "text",
  required: true,
  showWhen: { fieldKey: "turno", operator: "is", value: "Noite" },
});
const fields = [turno, cnh, categoria, adicional];

test("campo condicional oculto nunca bloqueia o envio", () => {
  assert.deepEqual(validateExtraData(fields, { cnh: "Não" }), {});
});

test("campo condicional visível e obrigatório é exigido", () => {
  assert.deepEqual(Object.keys(validateExtraData(fields, { cnh: "Sim" })), ["categoria"]);
});

test("condição sobre múltipla escolha usa 'contém'", () => {
  const values = { turno: serializeMulti(["Manhã", "Noite"]) };
  assert.equal(isFieldVisible(adicional, values, fields), true);
  assert.equal(isFieldVisible(adicional, { turno: serializeMulti(["Manhã"]) }, fields), false);
});

test("múltipla escolha obrigatória vazia é erro", () => {
  const req = f({ key: "m", type: "multiselect", options: ["a"], required: true });
  assert.deepEqual(Object.keys(validateExtraData([req], { m: "[]" })), ["m"]);
});

test("parseMulti tolera texto solto legado", () => {
  assert.deepEqual(parseMulti("texto antigo"), ["texto antigo"]);
  assert.deepEqual(parseMulti(""), []);
});

test("formatExtraValue formata múltipla escolha e data", () => {
  assert.equal(formatExtraValue(turno, serializeMulti(["Manhã", "Tarde"])), "Manhã, Tarde");
  assert.equal(formatExtraValue(f({ key: "d", type: "date" }), "2026-09-23"), "23/09/2026");
  assert.equal(formatExtraValue(cnh, ""), null);
});

test("pruneHiddenExtraData descarta respostas de perguntas ocultas e mantém chaves antigas", () => {
  const out = pruneHiddenExtraData(fields, { cnh: "Não", categoria: "D", legado: "x" });
  assert.deepEqual(out, { cnh: "Não", legado: "x" });
});

test("configuração rejeita regra com resposta que não existe mais", () => {
  const res = jobRequestFormConfigSchema.safeParse({
    title: "X",
    description: "",
    fields: [cnh, { ...categoria, showWhen: { fieldKey: "cnh", operator: "is", value: "Talvez" } }],
  });
  assert.equal(res.success, false);
});

test("configuração exige opções em seleção e condição válida", () => {
  const bad = jobRequestFormConfigSchema.safeParse({
    title: "X",
    description: "",
    fields: [f({ key: "s", type: "select", label: "Setor", options: [] }), { ...adicional }],
  });
  assert.equal(bad.success, false);
  const ok = jobRequestFormConfigSchema.safeParse({ title: "X", description: "", fields });
  assert.equal(ok.success, true);
});
