// Proteção do formulário público de solicitação e e-mail de confirmação ao gestor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { HONEYPOT_FIELD, isHoneypotFilled } from "./submission-guard";
import { jobRequestSubmittedEmail } from "../email-templates";

test("campo-isca vazio ou ausente: pessoa de verdade", () => {
  assert.equal(HONEYPOT_FIELD, "website");
  assert.equal(isHoneypotFilled({ title: "Auxiliar" }), false);
  assert.equal(isHoneypotFilled({ website: "" }), false);
  assert.equal(isHoneypotFilled({ website: "   " }), false);
  assert.equal(isHoneypotFilled(null), false);
});

test("campo-isca preenchido: robô", () => {
  assert.equal(isHoneypotFilled({ website: "http://spam.example" }), true);
});

test("e-mail ao gestor confirma o número e o cargo e explica os próximos passos", () => {
  const { subject, html } = jobRequestSubmittedEmail({
    requesterName: "Ana Souza",
    jobTitle: "Auxiliar de Logística",
    requestCode: "REQ-2026-0021",
    rows: [["Filial", "Matriz (SJP)"]],
  });
  assert.equal(subject, "Recebemos sua solicitação REQ-2026-0021 · Auxiliar de Logística");
  assert.match(html, /Olá, Ana!/);
  assert.match(html, /Matriz \(SJP\)/);
  assert.match(html, /e-mail a cada etapa/);
});

test("e-mail ao gestor escapa o que veio do formulário", () => {
  const { html } = jobRequestSubmittedEmail({
    requesterName: "<b>x</b>",
    jobTitle: "<script>alert(1)</script>",
    requestCode: null,
    rows: [],
  });
  assert.doesNotMatch(html, /<script>alert/);
});
