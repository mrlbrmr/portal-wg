import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TEST_LINK_DAYS, supersededSessionIds, testLinkExpiresAt } from "./link-validity";

test("link nasce com 7 dias de prazo por padrão", () => {
  assert.equal(DEFAULT_TEST_LINK_DAYS, 7);
  assert.equal(testLinkExpiresAt(new Date("2026-11-12T12:00:00Z")), "2026-11-19T12:00:00.000Z");
  assert.equal(testLinkExpiresAt(new Date("2026-11-12T12:00:00Z"), 3), "2026-11-15T12:00:00.000Z");
});

test("concluir um teste invalida só os outros envios pendentes do mesmo teste e candidatura", () => {
  const base = { applicationId: "app1", templateId: "big5", submittedAt: null, invalidadoEm: null };
  const done = { ...base, id: "s1", submittedAt: "2026-11-12T10:00:00Z" };
  const all = [
    done,
    { ...base, id: "s2" }, // pendente, mesmo teste → invalida
    { ...base, id: "s3", templateId: "excel" }, // outro teste → mantém
    { ...base, id: "s4", applicationId: "app2" }, // outra candidatura → mantém
    { ...base, id: "s5", submittedAt: "2026-10-01T00:00:00Z" }, // já respondido → mantém
    { ...base, id: "s6", invalidadoEm: "2026-10-01T00:00:00Z" }, // já invalidado → mantém
  ];
  assert.deepEqual(supersededSessionIds(done, all), ["s2"]);
});

test("envio sem candidatura (convite do Banco de Talentos) não invalida nada", () => {
  const s = { id: "t1", applicationId: null, templateId: "big5", submittedAt: "x", invalidadoEm: null };
  assert.deepEqual(supersededSessionIds(s, [s, { ...s, id: "t2", submittedAt: null }]), []);
});
