import { test } from "node:test";
import assert from "node:assert/strict";
import {
  firstOpenedAtByJob,
  sortByPublishedDesc,
  summaryFromHtml,
  toIntranetJob,
  type IntranetJobRow,
} from "./intranet-feed";

const row: IntranetJobRow = {
  id: "job-1",
  code: "VAG-2026-0031",
  title: "Analista de Logística",
  slug: "analista-de-logistica-sao-jose-dos-pinhais",
  department: "Logística",
  company: "WG Baterias",
  city: "São José dos Pinhais",
  state: "PR",
  modality: "PRESENTIAL",
  contractType: "CLT",
  workSchedule: null,
  description: "<h2>Sobre a vaga</h2><p>Você vai cuidar do fluxo de recebimento &amp; expedição.</p><h2>Requisitos</h2>",
  openPositions: 2,
  closingDate: null,
  createdAt: "2026-09-01T12:00:00Z",
};

test("resumo usa o primeiro parágrafo, sem HTML e com entidades decodificadas", () => {
  assert.equal(summaryFromHtml(row.description), "Você vai cuidar do fluxo de recebimento & expedição.");
});

test("resumo longo é cortado em palavra inteira", () => {
  const long = `<p>${"palavra ".repeat(60)}</p>`;
  const s = summaryFromHtml(long, 50)!;
  assert.ok(s.endsWith("…"));
  assert.ok(s.length <= 51);
  assert.ok(!s.includes("palavr…"));
});

test("resumo pula parágrafo que é rótulo e usa a 1ª responsabilidade (vaga só em listas)", () => {
  // Formato real da vaga de Maringá (25/09/2026): só listas, e o único <p> é um rótulo.
  const html =
    "<h3>Responsabilidades</h3><ul><li>Realiza atendimento – pessoal ou telefônico – aos clientes junto ao balcão;</li>" +
    "<li>Faturamento</li></ul><h3>Benefícios</h3><ul><li>💰 <strong>Remuneração</strong> - A combinar.</li></ul>" +
    "<p>Após 90 dias de experiência:</p><ul><li>🏋️ Gympass</li></ul>";
  assert.equal(
    summaryFromHtml(html),
    "Realiza atendimento – pessoal ou telefônico – aos clientes junto ao balcão;"
  );
});

test("parágrafo de apresentação ganha de item de lista, mesmo vindo depois", () => {
  const html =
    "<ul><li>Item de lista comprido o bastante para virar resumo sozinho</li></ul>" +
    "<p>Curto.</p><p>Buscamos alguém que goste de atender clientes e resolver problemas.</p>";
  assert.equal(summaryFromHtml(html), "Buscamos alguém que goste de atender clientes e resolver problemas.");
});

test("sem frase de verdade, não há resumo", () => {
  assert.equal(summaryFromHtml("<h3>Benefícios</h3><ul><li>VR</li><li>VA</li></ul><p>Após 90 dias:</p>"), null);
});

test("resumo vazio vira null", () => {
  assert.equal(summaryFromHtml(null), null);
  assert.equal(summaryFromHtml("<p> </p>"), null);
});

test("publicação = primeira vez que a vaga ficou aberta", () => {
  const map = firstOpenedAtByJob([
    { jobId: "job-1", status: "DRAFT", changedAt: "2026-09-01T12:00:00Z" },
    { jobId: "job-1", status: "SCREENING", changedAt: "2026-09-10T12:00:00Z" },
    { jobId: "job-1", status: "ACTIVE", changedAt: "2026-09-05T12:00:00Z" },
    { jobId: "job-1", status: "PAUSED", changedAt: "2026-09-04T12:00:00Z" },
  ]);
  assert.equal(map.get("job-1"), "2026-09-05T12:00:00Z");
});

test("sem histórico, a publicação é a criação; link usa o slug", () => {
  const job = toIntranetJob(row, undefined, "https://carreiras.wgbaterias.com.br");
  assert.equal(job.publishedAt, "2026-09-01T12:00:00.000Z");
  assert.equal(job.url, "https://carreiras.wgbaterias.com.br/vagas/analista-de-logistica-sao-jose-dos-pinhais");
  assert.equal(job.modality, "Presencial");
  assert.equal(job.contractType, "CLT");
});

test("sem slug, o link usa o id", () => {
  const job = toIntranetJob({ ...row, slug: null }, undefined, "https://x");
  assert.equal(job.url, "https://x/vagas/job-1");
});

test("resposta não carrega campos internos", () => {
  const job = toIntranetJob(row, undefined, "https://x") as unknown as Record<string, unknown>;
  for (const k of ["salary", "responsible", "hiringManager", "approvedScope", "requestId", "description"]) {
    assert.ok(!(k in job), `campo ${k} não deveria sair`);
  }
});

test("ordena da publicação mais recente para a mais antiga", () => {
  const a = toIntranetJob(row, "2026-09-02T00:00:00Z", "https://x");
  const b = toIntranetJob({ ...row, id: "job-2" }, "2026-09-20T00:00:00Z", "https://x");
  assert.deepEqual(sortByPublishedDesc([a, b]).map((j) => j.id), ["job-2", "job-1"]);
});
