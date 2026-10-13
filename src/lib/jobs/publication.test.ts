import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXTERNAL_VISIBILITIES,
  INTRANET_VISIBILITIES,
  LINK_VISIBILITIES,
  PORTAL_LISTED_VISIBILITIES,
  PUBLICATION_OPTIONS,
  externalBlockReason,
  isVisibleOn,
  publicationIndicator,
  publicationState,
} from "./publication";
import { onlyExternalVisible, onlyIntranetVisible, onlyLinkAccessible, onlyPublicVisible } from "@/lib/jobs-query";
import { jobStatusDisplay } from "@/lib/recruitment/job-presentation";

const NOW = new Date("2026-10-13T12:00:00Z");
const open = (visibility: string, extra: Record<string, unknown> = {}) => ({ status: "ACTIVE", visibility, closingDate: null, ...extra });

/** Query builder falso: registra os filtros que os helpers aplicam (mesma API fluente do PostgREST). */
function fakeQuery() {
  const calls: Array<[string, unknown, unknown?]> = [];
  const q = {
    calls,
    in(col: string, values: unknown) {
      calls.push(["in", col, values]);
      return q;
    },
    or(expr: string) {
      calls.push(["or", expr]);
      return q;
    },
  };
  return q;
}
const visibilityFilter = (q: ReturnType<typeof fakeQuery>) =>
  q.calls.find((c) => c[0] === "in" && c[1] === "visibility")?.[2] as string[] | undefined;

// ── 7. Vaga OPEN + "Não publicar" não aparece publicamente ──────────────────────────────

test("7. aberta + Não publicar: processo apto, mas fora de TODOS os canais e sem candidatura pelo portal", () => {
  const s = publicationState(open("NONE"), NOW);
  assert.equal(s.publishable, true, "o processo continua aberto");
  assert.equal(s.published, false);
  assert.deepEqual(s.channels, { PORTAL: false, INTRANET: false, EXTERNAL: false, LINK: false });
  assert.equal(s.acceptsApplications, false);
});

test("7. nenhuma lista de canais inclui NONE (portal, intranet, externos, link)", () => {
  for (const list of [PORTAL_LISTED_VISIBILITIES, INTRANET_VISIBILITIES, EXTERNAL_VISIBILITIES, LINK_VISIBILITIES]) {
    assert.ok(!list.includes("NONE"));
  }
});

// ── 8. NONE → BOTH publica ──────────────────────────────────────────────────────────────

test("8. NONE → BOTH publica no Portal, Intranet, externos e link — sem recriar a vaga", () => {
  const job = open("NONE");
  assert.equal(publicationState(job, NOW).published, false);
  const edited = { ...job, visibility: "BOTH" };
  const s = publicationState(edited, NOW);
  assert.deepEqual(s.channels, { PORTAL: true, INTRANET: true, EXTERNAL: true, LINK: true });
  assert.equal(s.acceptsApplications, true);
});

test("8. NONE → PUBLIC / INTERNAL habilitam só os canais da opção", () => {
  assert.deepEqual(publicationState(open("PUBLIC"), NOW).channels, { PORTAL: true, INTRANET: false, EXTERNAL: true, LINK: true });
  assert.deepEqual(publicationState(open("INTERNAL"), NOW).channels, { PORTAL: false, INTRANET: true, EXTERNAL: false, LINK: true });
});

// ── 9. BOTH → NONE retira dos canais ────────────────────────────────────────────────────

test("9. BOTH → NONE tira de todos os canais na hora (status e candidatos intactos)", () => {
  const job = open("BOTH");
  assert.equal(isVisibleOn(job, "PORTAL", NOW), true);
  const unpublished = { ...job, visibility: "NONE" };
  for (const ch of ["PORTAL", "INTRANET", "EXTERNAL", "LINK"] as const) assert.equal(isVisibleOn(unpublished, ch, NOW), false);
  assert.equal(unpublished.status, "ACTIVE", "status do processo não muda");
});

// ── 10. Não publicada não aparece nas Vagas Internas ────────────────────────────────────

test("10. Vagas Internas (Intranet) filtram por publicação — NONE e PUBLIC ficam de fora", () => {
  const q = fakeQuery();
  onlyIntranetVisible(q);
  const vis = visibilityFilter(q);
  assert.deepEqual([...(vis ?? [])].sort(), ["BOTH", "INTERNAL"]);
  assert.ok(q.calls.some((c) => c[0] === "in" && c[1] === "status"), "também exige processo aberto");
  assert.equal(isVisibleOn(open("NONE"), "INTRANET", NOW), false);
});

// ── 11. Não publicada não aparece em feeds/APIs públicas ────────────────────────────────

test("11. portal (home/sitemap/API), feeds Google/Indeed e página pelo link excluem NONE", () => {
  for (const helper of [onlyPublicVisible, onlyExternalVisible, onlyLinkAccessible]) {
    const q = fakeQuery();
    helper(q);
    const vis = visibilityFilter(q);
    assert.ok(vis, `${helper.name} precisa filtrar a publicação`);
    assert.ok(!vis!.includes("NONE"), `${helper.name} não pode incluir NONE`);
  }
  const ext = fakeQuery();
  onlyExternalVisible(ext);
  assert.deepEqual([...(visibilityFilter(ext) ?? [])].sort(), ["BOTH", "PUBLIC"], "Somente Intranet também fica fora dos feeds");
});

// ── Regra completa: status + canal + prazo ──────────────────────────────────────────────

test("processo fora do ar (Rascunho/Pausada/Encerrada) não aparece em canal nenhum, qualquer que seja a publicação", () => {
  for (const status of ["DRAFT", "PAUSED", "FILLED", "CLOSED"]) {
    const s = publicationState({ status, visibility: "BOTH", closingDate: null }, NOW);
    assert.equal(s.published, false, status);
    assert.equal(Object.values(s.channels).some(Boolean), false, status);
  }
});

test("inscrições vencidas: sai das listas e feeds; a página abre pelo link mas não aceita candidatura", () => {
  const s = publicationState(open("BOTH", { closingDate: "2026-10-01T00:00:00Z" }), NOW);
  assert.equal(s.channels.PORTAL, false);
  assert.equal(s.channels.EXTERNAL, false);
  assert.equal(s.channels.LINK, true);
  assert.equal(s.acceptsApplications, false);
});

test("valor de publicação desconhecido falha fechado (não publica)", () => {
  assert.equal(publicationState(open("QUALQUER"), NOW).published, false);
});

// ── Indicadores do painel ───────────────────────────────────────────────────────────────

test("indicador: Aberta • Publicada × Aberta • Não publicada; Rascunho/Pausada/Encerrada sem indicador", () => {
  assert.equal(jobStatusDisplay({ status: "ACTIVE", visibility: "BOTH" }).label, "Aberta • Publicada");
  assert.equal(jobStatusDisplay({ status: "ACTIVE", visibility: "NONE" }).label, "Aberta • Não publicada");
  assert.equal(jobStatusDisplay({ status: "SCREENING", visibility: "NONE" }).label, "Aberta • Não publicada", "etapa legada = aberta");
  assert.equal(jobStatusDisplay({ status: "DRAFT", visibility: "NONE" }).label, "Rascunho", "não confundir com rascunho");
  assert.equal(jobStatusDisplay({ status: "PAUSED", visibility: "BOTH" }).label, "Pausada");
  assert.equal(jobStatusDisplay({ status: "FILLED", visibility: "BOTH" }).label, "Encerrada");
  assert.equal(publicationIndicator({ status: "DRAFT", visibility: "BOTH" }), null);
});

test("opções da tela: as quatro, com Não publicar primeiro", () => {
  assert.deepEqual(
    PUBLICATION_OPTIONS.map((o) => o.value),
    ["NONE", "BOTH", "PUBLIC", "INTERNAL"]
  );
});

test("aba Divulgação explica por que não há canais externos", () => {
  assert.equal(externalBlockReason({ status: "ACTIVE", visibility: "BOTH" }), null);
  assert.match(externalBlockReason({ status: "ACTIVE", visibility: "NONE" }) ?? "", /Não publicar/);
  assert.match(externalBlockReason({ status: "ACTIVE", visibility: "INTERNAL" }) ?? "", /Somente Intranet/);
  assert.match(externalBlockReason({ status: "DRAFT", visibility: "BOTH" }) ?? "", /não está aberto/);
});
