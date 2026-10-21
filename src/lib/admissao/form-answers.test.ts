import { test } from "node:test";
import assert from "node:assert/strict";
import { answersToRow } from "./form-answers";

test("zera detalhes que dependem de uma resposta 'Sim' quando ela é 'Não'", () => {
  const row = answersToRow({
    needsTransportVoucher: false,
    transportVoucherDetails: "2 passagens",
    hasItauAccount: false,
    bankAgency: "0001",
    bankAccount: "123",
    noOperationalUniform: true,
    uniformPants: "42",
    uniformShoe: "40",
  });
  assert.equal(row.transportVoucherDetails, null);
  assert.equal(row.bankAgency, null);
  assert.equal(row.bankAccount, null);
  assert.equal(row.uniformPants, null);
  assert.equal(row.uniformShoe, null);
});

test("mantém os detalhes quando a resposta é 'Sim' e descarta extras vazios", () => {
  const row = answersToRow({
    hasItauAccount: true,
    bankAgency: "0001",
    formExtras: { pisNumber: "123.45678.90-1", outro: "  " },
    uniformShirt: "",
  });
  assert.equal(row.bankAgency, "0001");
  assert.deepEqual(row.formExtras, { pisNumber: "123.45678.90-1" });
  assert.equal(row.uniformShirt, null);
});
