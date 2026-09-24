// Testes do histórico da admissão (history.ts) — só eventos gravados, com o de → para real.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAdmissionHistory, type HistoryInput } from "./history";

function input(over: Partial<HistoryInput> = {}): HistoryInput {
  return {
    createdAt: "2026-09-20T10:00:00Z",
    createdByName: "Murilo Bremer",
    digitalFormSubmittedAt: null,
    attachments: [],
    logs: [],
    ...over,
  };
}

describe("buildAdmissionHistory", () => {
  it("mudança de etapa mostra quem mudou e o de → para", () => {
    const items = buildAdmissionHistory(
      input({
        logs: [
          {
            id: 1,
            action: "STAGE_CHANGED",
            description: "Formulário recebido → Agendamento de ASO",
            metadata: { from: "Formulário recebido", to: "Agendamento de ASO" },
            createdAt: "2026-09-24T12:32:00Z",
            userName: "Murilo Bremer",
          },
        ],
      })
    );
    assert.equal(items[0].title, "Murilo Bremer alterou a etapa");
    assert.equal(items[0].description, "“Formulário recebido” → “Agendamento de ASO”");
  });

  it("edição lista os campos alterados", () => {
    const [item] = buildAdmissionHistory(
      input({
        logs: [
          {
            id: 2,
            action: "ADMISSION_UPDATED",
            description: "2 campos alterados",
            metadata: { changes: [{ label: "Turno", from: null, to: "Comercial" }, { label: "Gestor", from: "Ana", to: "Carlos" }] },
            createdAt: "2026-09-24T13:00:00Z",
            userName: null,
          },
        ],
      })
    );
    assert.equal(item.title, "Admissão editada");
    assert.equal(item.description, "Turno: vazio → “Comercial” · Gestor: “Ana” → “Carlos”");
  });

  it("não duplica o envio do formulário quando há log", () => {
    const items = buildAdmissionHistory(
      input({
        digitalFormSubmittedAt: "2026-09-23T17:32:00Z",
        logs: [{ id: 3, action: "FORM_SUBMITTED", description: null, metadata: null, createdAt: "2026-09-23T17:32:00Z", userName: null }],
      })
    );
    assert.equal(items.filter((i) => i.title.includes("concluiu o formulário")).length, 1);
  });

  it("formulário antigo sem log usa a data gravada na admissão", () => {
    const items = buildAdmissionHistory(input({ digitalFormSubmittedAt: "2026-09-23T17:32:00Z" }));
    assert.ok(items.some((i) => i.id === "form"));
  });

  it("ações fora do catálogo não aparecem", () => {
    const items = buildAdmissionHistory(
      input({ logs: [{ id: 4, action: "GET_SESSION_ERROR", description: "x", metadata: null, createdAt: "2026-09-24T10:00:00Z", userName: null }] })
    );
    assert.equal(items.length, 1);
  });

  it("anexos do mesmo lote viram um evento", () => {
    const items = buildAdmissionHistory(
      input({
        attachments: [
          { id: "a", createdAt: "2026-09-23T17:30:00Z", uploadedByName: null, label: "RG" },
          { id: "b", createdAt: "2026-09-23T17:31:00Z", uploadedByName: null, label: "CPF" },
          { id: "c", createdAt: "2026-09-24T09:00:00Z", uploadedByName: "Murilo Bremer", label: "ASO" },
        ],
      })
    );
    const docs = items.filter((i) => i.id.startsWith("att-"));
    assert.equal(docs.length, 2);
    assert.ok(docs.some((d) => d.title === "2 documentos recebidos" && d.description === "RG, CPF"));
    assert.ok(docs.some((d) => d.title === "Murilo Bremer enviou 1 documento"));
  });

  it("ordem decrescente", () => {
    const items = buildAdmissionHistory(input({ digitalFormSubmittedAt: "2026-09-23T17:32:00Z" }));
    assert.equal(items[0].id, "form");
    assert.equal(items[items.length - 1].id, "created");
  });
});
