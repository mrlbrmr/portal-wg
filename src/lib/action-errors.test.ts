import { test } from "node:test";
import assert from "node:assert/strict";
import { actionErrorMessage, isStaleDeploymentError } from "./action-errors";

test("página aberta antes de um deploy: pede para recarregar", () => {
  const e = new Error('Server Action "408549e9bacfe05822a173a4a5a88e9de7bd3177e1" was not found on the server.');
  assert.equal(isStaleDeploymentError(e), true);
  assert.match(actionErrorMessage(e), /Recarregue a página/);
  assert.equal(isStaleDeploymentError(new Error("Failed to find Server Action")), true);
});

test("outras falhas de chamada: mensagem de conexão, sem expor detalhes técnicos", () => {
  assert.equal(isStaleDeploymentError(new TypeError("Failed to fetch")), false);
  assert.match(actionErrorMessage(new TypeError("Failed to fetch")), /conexão/);
  assert.match(actionErrorMessage(undefined), /nada foi salvo/);
});
