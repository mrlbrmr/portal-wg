import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluationGroup, interviewTypeLabel, isHumanEvaluation, isTestMirror, recommendationInfo } from "./catalog";
import { docFromPlainText, docToPlainText, reportExcerpt, safeHref, sanitizeReportDoc, type ReportDoc } from "./document";
import { looksLikeMarkdown, markdownToEditorHtml } from "./markdown";
import { buildEvaluationRow } from "./rows";
import { evaluationInputSchema, isValidDay } from "./schema";
import { REPORT_TEMPLATES, findTemplate, templateDoc } from "./templates";

const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

// ── Catálogo ────────────────────────────────────────────────────────────────

test("cópia de teste online fica fora do hub (fonte única = assessment_sessions)", () => {
  const mirror = { kind: "PERSONALITY_TEST", source: "HUMAN", evaluator: "Automático", metadata: { sessionId: "s1" } };
  assert.equal(isTestMirror(mirror), true);
  assert.equal(evaluationGroup(mirror), "hidden");
  assert.equal(isHumanEvaluation(mirror), false);
  // Mesmo sem metadata, o avaliador "Automático" denuncia a cópia antiga.
  assert.equal(isTestMirror({ kind: "TECHNICAL_TEST", evaluator: "Automático" }), true);
});

test("grupos do hub: entrevista, referência, externa (inclui teste manual antigo) e IA", () => {
  assert.equal(evaluationGroup({ kind: "INTERVIEW" }), "interview");
  assert.equal(evaluationGroup({ kind: "REFERENCE" }), "reference");
  assert.equal(evaluationGroup({ kind: "OTHER" }), "external");
  assert.equal(evaluationGroup({ kind: "TECHNICAL_TEST", evaluator: "Murilo" }), "external");
  assert.equal(evaluationGroup({ kind: "AI_FIT", source: "AI" }), "ai");
  assert.equal(isHumanEvaluation({ kind: "AI_FIT", source: "AI" }), false);
});

test("rótulos: entrevista antiga sem tipo e recomendação desconhecida caem no padrão", () => {
  assert.equal(interviewTypeLabel(null), "Entrevista");
  assert.equal(interviewTypeLabel("MANAGER"), "Entrevista com gestor");
  assert.deepEqual(recommendationInfo("ADVANCE_WITH_CAVEATS"), { label: "Avançar com ressalvas", tone: "warning" });
  assert.deepEqual(recommendationInfo("XYZ"), { label: "Sem definição", tone: "neutral" });
});

// ── Documento: sanitização (XSS) ────────────────────────────────────────────

test("links só http/https/mailto — javascript:, data: e vbscript: são recusados", () => {
  assert.equal(safeHref("https://wg.com.br/x"), "https://wg.com.br/x");
  assert.equal(safeHref("mailto:rh@wg.com.br"), "mailto:rh@wg.com.br");
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref(" JaVaScRiPt:alert(1)"), null);
  assert.equal(safeHref("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(safeHref("vbscript:msgbox"), null);
  assert.equal(safeHref('https://x.com/" onmouseover="alert(1)'), null);
});

test("sanitização remove nós/marcas desconhecidos, atributos extras e links inseguros", () => {
  const input = {
    type: "doc",
    content: [
      { type: "script", content: [{ type: "text", text: "alert(1)" }] },
      { type: "iframe", attrs: { src: "https://evil" } },
      { type: "heading", attrs: { level: 6, onclick: "alert(1)" }, content: [{ type: "text", text: "Título" }] },
      {
        type: "paragraph",
        attrs: { style: "color:red" },
        content: [
          { type: "text", text: "perigo", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "bold" }] },
          { type: "text", text: " ok", marks: [{ type: "link", attrs: { href: "https://wg.com.br", onclick: "x" } }, { type: "evil" }] },
          { type: "text", text: "" },
        ],
      },
    ],
  };
  const r = sanitizeReportDoc(input);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.doc.content.map((n) => n.type), ["heading", "paragraph"]);
  assert.deepEqual(r.doc.content[0].attrs, { level: 3 });
  const [danger, ok] = r.doc.content[1].content ?? [];
  assert.equal(r.doc.content[1].attrs, undefined);
  assert.deepEqual(danger.marks, [{ type: "bold" }]);
  assert.deepEqual(ok.marks, [{ type: "link", attrs: { href: "https://wg.com.br", target: "_blank", rel: "noopener noreferrer nofollow" } }]);
  assert.equal(r.doc.content[1].content?.length, 2);
  assert.ok(!JSON.stringify(r.doc).includes("alert"));
});

test("tabela, listas, citação e divisor sobrevivem; atributos de célula são limitados", () => {
  const input = {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          { type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [para("Critério")] }, { type: "tableHeader", content: [para("Avaliação")] }] },
          { type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 999 }, content: [para("Comunicação")] }, { type: "tableCell", content: [para("Forte")] }] },
        ],
      },
      { type: "bulletList", content: [{ type: "listItem", content: [para("Ponto A")] }] },
      { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [para("Passo")] }] },
      { type: "blockquote", content: [para("Citação")] },
      { type: "horizontalRule", content: [para("nada")] },
    ],
  };
  const r = sanitizeReportDoc(input);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.doc.content.map((n) => n.type), ["table", "bulletList", "orderedList", "blockquote", "horizontalRule"]);
  assert.equal(r.doc.content[0].content?.[1].content?.[0].attrs, undefined);
  assert.deepEqual(r.doc.content[2].attrs, { start: 3 });
  assert.equal(r.doc.content[4].content, undefined);
  assert.equal(r.text, "Critério | Avaliação\nComunicação | Forte\n- Ponto A\n- Passo\nCitação");
});

test("documento vazio, inválido ou grande demais é recusado", () => {
  assert.equal(sanitizeReportDoc(null).ok, false);
  assert.equal(sanitizeReportDoc({ type: "paragraph" }).ok, false);
  const empty = sanitizeReportDoc({ type: "doc", content: [{ type: "paragraph" }] });
  assert.equal(empty.ok, false);
  const huge = sanitizeReportDoc({ type: "doc", content: [para("x".repeat(200_001))] });
  assert.equal(huge.ok, false);
  let deep: Record<string, unknown> = para("fundo");
  for (let i = 0; i < 60; i++) deep = { type: "blockquote", content: [deep] };
  assert.equal(sanitizeReportDoc({ type: "doc", content: [deep] }).ok, false);
});

test("trecho ignora títulos/tabelas e corta em palavra inteira", () => {
  const doc: ReportDoc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Parecer de entrevista" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Síntese do perfil" }] },
      { type: "paragraph" },
      para("Candidata apresenta boa aderência à vaga, com destaque para a comunicação e a organização do trabalho em equipe."),
    ],
  };
  assert.equal(reportExcerpt(doc, 60), "Candidata apresenta boa aderência à vaga, com destaque para…");
  assert.equal(reportExcerpt({ type: "doc", content: [] }), "");
});

test("parecer antigo em texto puro vira documento de parágrafos", () => {
  const doc = docFromPlainText("Primeira linha\nsegunda\n\nOutro parágrafo");
  assert.equal(doc.content.length, 2);
  assert.equal(docToPlainText(doc), "Primeira linha\nsegunda\nOutro parágrafo");
});

// ── Markdown ────────────────────────────────────────────────────────────────

test("Markdown do Claude/ChatGPT: títulos, listas, negrito e tabela GFM", () => {
  const md = [
    "# Parecer de Entrevista",
    "",
    "## Síntese do perfil",
    "",
    "Texto com **negrito** e *itálico*.",
    "",
    "| Critério | Avaliação | Evidência |",
    "| --- | --- | --- |",
    "| Comunicação | Forte | Clara<br>objetiva |",
    "",
    "- Ponto 1",
    "- Ponto 2",
    "",
    "1. Primeiro",
    "",
    "> Observação",
    "",
    "---",
    "",
    "#### Subtítulo profundo",
  ].join("\n");
  const html = markdownToEditorHtml(md);
  assert.match(html, /<h1>Parecer de Entrevista<\/h1>/);
  assert.match(html, /<h2>Síntese do perfil<\/h2>/);
  assert.match(html, /<strong>negrito<\/strong>/);
  assert.match(html, /<em>itálico<\/em>/);
  assert.match(html, /<table>[\s\S]*<th>Critério<\/th>[\s\S]*<td>Clara<br>objetiva<\/td>/);
  assert.match(html, /<ul>\s*<li>Ponto 1<\/li>/);
  assert.match(html, /<ol>\s*<li>Primeiro<\/li>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<hr>/);
  assert.match(html, /<h3>Subtítulo profundo<\/h3>/);
});

test("Markdown: HTML cru é escapado, imagens viram texto e links inseguros saem", () => {
  const html = markdownToEditorHtml(
    [
      "<script>alert(1)</script>",
      "",
      'Texto <img src=x onerror="alert(1)"> e <a href="javascript:alert(1)">clique</a>',
      "",
      "![foto](https://evil/x.png)",
      "",
      "[ruim](javascript:alert(1)) e [bom](https://wg.com.br)",
    ].join("\n")
  );
  assert.ok(!/<script/i.test(html));
  assert.ok(!/<img/i.test(html));
  assert.ok(!/href="javascript/i.test(html));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<a href="https:\/\/wg\.com\.br">bom<\/a>/);
  assert.match(html, /foto/);
});

test("detecção de Markdown ao colar texto puro", () => {
  assert.equal(looksLikeMarkdown("## Síntese\nTexto"), true);
  assert.equal(looksLikeMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |"), true);
  assert.equal(looksLikeMarkdown("- um\n- dois\n\n**forte**"), true);
  assert.equal(looksLikeMarkdown("Candidata chegou no horário.\nConversa tranquila."), false);
  assert.equal(looksLikeMarkdown("- só uma lista\n- simples"), false);
  assert.equal(markdownToEditorHtml("   "), "");
});

// ── Modelos ─────────────────────────────────────────────────────────────────

test("modelos: completo com 8 seções H3, simplificado com 4, em branco vazio", () => {
  const complete = templateDoc(findTemplate("complete")!);
  const headings = complete.content.filter((n) => n.type === "heading");
  assert.equal(headings.length, 8);
  assert.ok(headings.every((h) => h.attrs?.level === 3));
  assert.equal(headings[0].content?.[0].text, "Síntese do perfil");
  assert.equal(templateDoc(findTemplate("simple")!).content.filter((n) => n.type === "heading").length, 4);
  assert.deepEqual(templateDoc(findTemplate("blank")!), { type: "doc", content: [{ type: "paragraph" }] });
  assert.equal(findTemplate("x"), null);
  assert.ok(REPORT_TEMPLATES.every((t) => sanitizeReportDoc(templateDoc(t)).ok === (t.sections.length > 0)));
});

// ── Entrada da API ──────────────────────────────────────────────────────────

const now = new Date("2026-10-14T15:00:00Z");

test("datas: formato, calendário real e limite futuro", () => {
  assert.equal(isValidDay("2026-10-14", now), true);
  assert.equal(isValidDay("2026-02-30", now), false);
  assert.equal(isValidDay("14/10/2026", now), false);
  assert.equal(isValidDay("2030-01-01", now), false);
});

test("entrevista: sem nota, com recomendação estruturada e conteúdo sanitizado", () => {
  const parsed = evaluationInputSchema.safeParse({
    kind: "INTERVIEW",
    interviewType: "HR",
    occurredAt: "2026-10-14",
    recommendation: "ADVANCE_WITH_CAVEATS",
    evaluator: "Murilo Bremer",
    score: 90,
    content: { type: "doc", content: [para("Boa aderência"), { type: "script" }] },
  });
  assert.ok(parsed.success);
  if (!parsed.success) return;
  const built = buildEvaluationRow(parsed.data);
  assert.ok(built.ok);
  if (!built.ok) return;
  assert.equal(built.row.title, "Entrevista RH");
  assert.equal(built.row.occurredAt, "2026-10-14T12:00:00Z");
  assert.equal("score" in built.row, false);
  assert.equal(built.row.contentText, "Boa aderência");
  assert.equal(built.row.referenceCompany, null);
  assert.equal(JSON.stringify(built.row.content).includes("script"), false);
});

test("entrevista sem texto no parecer e tipo/recomendação fora da lista são recusados", () => {
  const base = { kind: "INTERVIEW", interviewType: "HR", occurredAt: "2026-10-14", recommendation: "ADVANCE", evaluator: "Murilo" };
  const empty = evaluationInputSchema.parse({ ...base, content: { type: "doc", content: [{ type: "paragraph" }] } });
  assert.equal(buildEvaluationRow(empty).ok, false);
  assert.equal(evaluationInputSchema.safeParse({ ...base, interviewType: "X", content: {} }).success, false);
  assert.equal(evaluationInputSchema.safeParse({ ...base, recommendation: "APROVADO", content: {} }).success, false);
});

test("referência grava os campos próprios e limpa os da entrevista", () => {
  const input = evaluationInputSchema.parse({
    kind: "REFERENCE",
    referenceCompany: "Empresa X",
    referenceContact: "Fulana",
    referenceRelationship: "",
    occurredAt: "2026-10-10",
    referenceResult: "ATTENTION",
    summary: "  ",
  });
  const built = buildEvaluationRow(input);
  assert.ok(built.ok);
  if (!built.ok) return;
  assert.equal(built.row.kind, "REFERENCE");
  assert.equal(built.row.referenceRelationship, null);
  assert.equal(built.row.summary, null);
  assert.equal(built.row.recommendation, null);
  assert.equal(built.row.content, null);
  assert.equal(evaluationInputSchema.safeParse({ ...input, referenceResult: "OTIMA" }).success, false);
});

test("avaliação externa: título obrigatório; testes do Portal não são registráveis à mão", () => {
  assert.equal(evaluationInputSchema.safeParse({ kind: "OTHER", title: "", occurredAt: "2026-10-10" }).success, false);
  assert.ok(evaluationInputSchema.safeParse({ kind: "OTHER", title: "Teste prático externo", occurredAt: "2026-10-10" }).success);
  assert.equal(evaluationInputSchema.safeParse({ kind: "TECHNICAL_TEST", occurredAt: "2026-10-10" }).success, false);
  assert.equal(evaluationInputSchema.safeParse({ kind: "PERSONALITY_TEST", occurredAt: "2026-10-10" }).success, false);
});
