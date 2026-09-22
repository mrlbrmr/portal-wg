import { test } from "node:test";
import assert from "node:assert/strict";
import { aiFitBand, latestAiAnalysis, parseAiAnalysis, parseLegacySummary } from "./ai-analysis";

// Texto exatamente no formato montado pela rota /analyze antes da versão estruturada.
const LEGACY = [
  "Atuou 3 anos como assistente comercial na Empresa X, atendendo ao requisito de experiência.",
  "",
  "Último cargo: Assistente Comercial · Experiência: 3 ano(s) · Formação: Administração",
  "",
  "Pontos fortes:",
  "• Experiência com prospecção de clientes",
  "• Excel avançado",
  "",
  "Lacunas:",
  "• Não menciona ERP",
].join("\n");

test("texto legado: separa motivo, perfil do currículo, pontos fortes e lacunas", () => {
  const r = parseLegacySummary(LEGACY);
  assert.match(r.reason ?? "", /^Atuou 3 anos/);
  assert.deepEqual(r.strengths, ["Experiência com prospecção de clientes", "Excel avançado"]);
  assert.deepEqual(r.gaps, ["Não menciona ERP"]);
  assert.deepEqual(r.profile, {
    experienceYears: 3,
    education: "Administração",
    lastPosition: "Assistente Comercial",
    skills: [],
  });
});

test("análise antiga (sem metadata): usa o texto e não inventa critérios nem resumo", () => {
  const a = parseAiAnalysis({
    id: "a1",
    score: 83,
    summary: LEGACY,
    evaluator: "IA · Gemini",
    occurredAt: "2026-09-21T13:49:00Z",
    createdAt: "2026-09-21T13:49:00Z",
  });
  assert.equal(a.score, 83);
  assert.equal(a.band, "HIGH");
  assert.equal(a.engine, "Gemini");
  assert.equal(a.profileSummary, null);
  assert.deepEqual(a.criteria, []);
  assert.equal(a.strengths.length, 2);
});

test("análise estruturada: metadata prevalece e status desconhecido vira 'não identificado'", () => {
  const a = parseAiAnalysis({
    id: "a2",
    score: 61,
    summary: LEGACY,
    evaluator: "IA · Gemini",
    metadata: {
      version: 2,
      model: "gemini-3.6-flash",
      profileSummary: "Profissional formado em Administração.",
      fitReason: "Motivo estruturado.",
      strengths: ["Forte A"],
      gaps: [],
      criteria: [
        { criterion: "Excel", status: "MEETS", evidence: "Excel avançado" },
        { criterion: "ERP", status: "TALVEZ", evidence: "" },
      ],
      profile: { experienceYears: 3, education: null, lastPosition: null, skills: [] },
    },
    occurredAt: null,
    createdAt: "2026-09-21T13:49:00Z",
  });
  assert.equal(a.band, "PARTIAL");
  assert.equal(a.reason, "Motivo estruturado.");
  assert.equal(a.profileSummary, "Profissional formado em Administração.");
  assert.deepEqual(a.strengths, ["Forte A"]);
  assert.deepEqual(a.gaps, []);
  assert.deepEqual(a.criteria[1], { criterion: "ERP", status: "NOT_FOUND", evidence: null });
  assert.equal(a.analyzedAt, "2026-09-21T13:49:00Z");
});

test("faixas de aderência seguem os cortes da rota (70 / 50)", () => {
  assert.equal(aiFitBand(70), "HIGH");
  assert.equal(aiFitBand(69), "PARTIAL");
  assert.equal(aiFitBand(50), "PARTIAL");
  assert.equal(aiFitBand(49), "LOW");
  assert.equal(aiFitBand(null), null);
});

test("latestAiAnalysis: só considera AI_FIT de origem IA e pega a mais recente", () => {
  const base = { summary: null, evaluator: null, createdAt: "2026-09-01T00:00:00Z" };
  const r = latestAiAnalysis([
    { ...base, id: "old", kind: "AI_FIT", source: "AI", score: 40, occurredAt: "2026-09-01T10:00:00Z" },
    { ...base, id: "human", kind: "INTERVIEW", source: "HUMAN", score: 99, occurredAt: "2026-09-10T10:00:00Z" },
    { ...base, id: "new", kind: "AI_FIT", source: "AI", score: 80, occurredAt: "2026-09-05T10:00:00.000+00:00" },
  ]);
  assert.equal(r?.id, "new");
  assert.equal(latestAiAnalysis([]), null);
});
