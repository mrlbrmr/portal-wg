import { test } from "node:test";
import assert from "node:assert/strict";
import { isProtectedRoute, unauthenticatedAction } from "./route-protection";

test("APIs internas exigem sessão", () => {
  assert.equal(isProtectedRoute("/api/applications/c7", "PATCH"), true);
  assert.equal(isProtectedRoute("/api/applications/reorder", "POST"), true);
  assert.equal(isProtectedRoute("/api/admissoes/export", "GET"), true);
  assert.equal(isProtectedRoute("/api/jobs/abc", "PATCH"), true);
  assert.equal(isProtectedRoute("/api/jobs", "POST"), true);
  assert.equal(isProtectedRoute("/api/users/me", "GET"), true);
  assert.equal(isProtectedRoute("/api/homepage-config", "PUT"), true);
});

test("APIs públicas continuam abertas", () => {
  assert.equal(isProtectedRoute("/api/applications", "POST"), false); // candidatura
  assert.equal(isProtectedRoute("/api/jobs", "GET"), false); // "Carregar mais" do portal
  assert.equal(isProtectedRoute("/api/candidatura/status", "POST"), false);
  assert.equal(isProtectedRoute("/api/admissao/tok123/upload", "POST"), false); // admissão por token
  assert.equal(isProtectedRoute("/api/avaliacao/tok123", "POST"), false); // avaliação por token
  assert.equal(isProtectedRoute("/api/feed/indeed.xml", "GET"), false);
  assert.equal(isProtectedRoute("/api/intranet/jobs", "GET"), false);
  assert.equal(isProtectedRoute("/api/jornada/sync", "GET"), false);
  assert.equal(isProtectedRoute("/api/cron/formularios-parados", "GET"), false);
  assert.equal(isProtectedRoute("/api/webhooks/whatsapp", "POST"), false);
});

test("páginas internas exigem sessão; públicas não", () => {
  assert.equal(isProtectedRoute("/dashboard", "GET"), true);
  assert.equal(isProtectedRoute("/vagas/abc/candidatos", "GET"), true);
  assert.equal(isProtectedRoute("/vagas/abc/editar", "GET"), true);
  assert.equal(isProtectedRoute("/vagas/analista-de-rh", "GET"), false);
  assert.equal(isProtectedRoute("/admissao/tok123", "GET"), false);
  assert.equal(isProtectedRoute("/login", "GET"), false);
});

test("sem sessão: fetch em API recebe 401, nunca o redirect ao /login", () => {
  assert.equal(unauthenticatedAction("/api/applications/c7", "cors"), "unauthorized");
  assert.equal(unauthenticatedAction("/api/applications/c7", "same-origin"), "unauthorized");
  assert.equal(unauthenticatedAction("/api/applications/reorder", null), "unauthorized");
});

test("sem sessão: link aberto no navegador e páginas vão ao /login", () => {
  assert.equal(unauthenticatedAction("/api/applications/c7/resume", "navigate"), "login");
  assert.equal(unauthenticatedAction("/dashboard", null), "login");
  assert.equal(unauthenticatedAction("/vagas/abc/candidatos", "navigate"), "login");
  // Não confunde páginas que só começam com "api".
  assert.equal(unauthenticatedAction("/apis-internas", null), "login");
});
