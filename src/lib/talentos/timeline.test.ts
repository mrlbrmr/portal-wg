// Linha do tempo do talento (timeline.ts). Runner: `npm test`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTalentTimeline } from "./timeline";
import type { TalentApplication } from "./profile";

const app = (over: Partial<TalentApplication>): TalentApplication => ({
  id: "a1",
  jobId: "j1",
  jobTitle: "Auxiliar Administrativo",
  jobCode: null,
  jobStatus: "ACTIVE",
  jobArea: null,
  createdAt: "2026-09-22T10:00:00.000Z",
  source: "PORTAL",
  addedBy: null,
  stageId: "NEW",
  stageName: "Novas candidaturas",
  stageKind: "OPEN",
  stageColor: null,
  isOpen: true,
  resumeName: null,
  hasResume: false,
  resumeIsProfileCv: false,
  ...over,
});

describe("linha do tempo do talento", () => {
  it("candidatura + avanço + encerramento, do mais recente para o mais antigo", () => {
    const events = buildTalentTimeline({
      createdAt: "2026-09-22T10:00:00.000Z",
      origem: "VAGA_ESPECIFICA",
      applications: [app({})],
      stageHistory: [
        { id: "h1", applicationId: "a1", stageId: "NEW", stageName: "Novas candidaturas", stageKind: "OPEN", changedAt: "2026-09-22T10:00:01.000Z", changedBy: "Candidato" },
        { id: "h2", applicationId: "a1", stageId: "INTERVIEW", stageName: "Entrevista G&G", stageKind: "OPEN", changedAt: "2026-09-24T10:00:00.000Z", changedBy: "Murilo" },
        { id: "h3", applicationId: "a1", stageId: "REJECTED", stageName: "Reprovado", stageKind: "LOST", changedAt: "2026-09-27T10:00:00.000Z", changedBy: "Murilo" },
      ],
      sessions: [],
      events: [],
    });
    assert.deepEqual(
      events.map((e) => e.kind),
      ["CLOSED", "STAGE", "APPLIED", "JOINED"]
    );
    assert.equal(events[1].title, "Movido para Entrevista G&G — Auxiliar Administrativo");
  });

  it("não duplica a etapa gravada junto com a candidatura", () => {
    const events = buildTalentTimeline({
      createdAt: "2026-09-01T10:00:00.000Z",
      origem: "VAGA_ESPECIFICA",
      applications: [app({ source: "BANCO_TALENTOS", addedBy: "Murilo" })],
      stageHistory: [
        { id: "h1", applicationId: "a1", stageId: "NEW", stageName: "Novas candidaturas", stageKind: "OPEN", changedAt: "2026-09-22T10:00:02.000Z", changedBy: "Murilo (Banco de Talentos)" },
      ],
      sessions: [],
      events: [],
    });
    assert.equal(events.filter((e) => e.kind === "STAGE").length, 0);
    assert.equal(events[0].kind, "ADDED_FROM_BANK");
    assert.equal(events[0].title, "Adicionado à vaga Auxiliar Administrativo pelo Banco de Talentos");
  });

  it("cadastro manual usa o evento do log (com autor) no lugar de 'entrou no banco'", () => {
    const events = buildTalentTimeline({
      createdAt: "2026-09-01T10:00:00.000Z",
      origem: "CADASTRO_MANUAL",
      applications: [],
      stageHistory: [],
      sessions: [],
      events: [
        { id: "1", acao: "CRIADO", descricao: "Cadastrado manualmente no Banco de Talentos", createdAt: "2026-09-01T10:00:00.000Z", actorName: "Murilo" },
        { id: "2", acao: "ADICIONADO_A_VAGA", descricao: "Adicionado à vaga X", createdAt: "2026-09-02T10:00:00.000Z", actorName: "Murilo" },
      ],
    });
    assert.deepEqual(events.map((e) => e.kind), ["CREATED"]);
    assert.equal(events[0].actor, "Murilo");
  });
});
