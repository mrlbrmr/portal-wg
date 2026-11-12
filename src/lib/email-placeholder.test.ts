import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderEmail } from "./email-placeholder";

test("reconhece os fictícios encontrados em produção", () => {
  for (const e of ["email@email.com", "editar@email.com", "editar@editar.com", "editar@gmail.com", "ajustar@email.com", " EMAIL@Email.com "]) {
    assert.equal(isPlaceholderEmail(e), true, e);
  }
});

test("outros padrões fictícios comuns", () => {
  assert.equal(isPlaceholderEmail("sememail@hotmail.com"), true);
  assert.equal(isPlaceholderEmail("joao@teste.com"), true);
  assert.equal(isPlaceholderEmail("nao@gmail.com"), true);
});

test("e-mails reais e vazios não são fictícios", () => {
  assert.equal(isPlaceholderEmail("maria.silva@gmail.com"), false);
  assert.equal(isPlaceholderEmail("emailmarketing@empresa.com.br"), false);
  assert.equal(isPlaceholderEmail("editora@livros.com"), false);
  assert.equal(isPlaceholderEmail(""), false);
  assert.equal(isPlaceholderEmail(null), false);
  assert.equal(isPlaceholderEmail("sem-arroba"), false);
});
