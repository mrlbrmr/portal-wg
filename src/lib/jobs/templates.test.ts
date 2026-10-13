import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@/types/domain";
import { draftToPayload, jobToDraft, NEW_JOB_DEFAULTS } from "./draft";
import { approvedFields, type ApprovedScope } from "./approved-scope";
import {
  applyTemplate,
  duplicateName,
  isContentBlank,
  matchesTemplate,
  mergeTemplateContent,
  parseContent,
  planTemplate,
  revertTemplate,
  templateFromJob,
  templateToMarkdown,
  withContent,
  type JobTemplate,
} from "./templates";

const TEMPLATE: JobTemplate = {
  id: "tpl-aux-log",
  name: "Auxiliar de Logística",
  title: "Auxiliar de Logística",
  department: "Logística",
  contractType: "CLT",
  workSchedule: "Seg a Sex, 08h–17h48",
  about: null,
  responsibilities: "- Separar e conferir pedidos\n- Organizar o estoque",
  requiredRequirements: "- Ensino médio completo",
  desiredRequirements: "- Experiência com WMS",
  benefits: "- Vale-transporte\n- Refeição no local",
  active: true,
  updatedAt: "2026-10-13T12:00:00Z",
};

/** Vaga como create_job_from_request() a deixa: Rascunho, vínculo e escopo aprovado. */
function jobFromRequest(): Job {
  const scope: ApprovedScope = {
    requestCode: "REQ-2026-0042",
    title: "Auxiliar de Expedição",
    department: "Expedição",
    location: "Matriz",
    openings: 2,
    contractType: "CLT",
    workSchedule: "Turno B, 14h–22h",
    reasonType: "REPLACEMENT",
    requesterName: "Paulo Gestor",
  };
  return {
    id: "job-1",
    title: "Auxiliar de Expedição",
    department: "Expedição",
    company: "Matriz",
    city: null,
    state: null,
    isTalentPool: false,
    modality: "PRESENTIAL",
    contractType: "CLT",
    description:
      "### Responsabilidades\n\nSubstituir colaborador desligado no turno B.\n\n### Requisitos\n\n\n\n### Benefícios\n\n",
    responsibilities: "",
    requiredRequirements: "",
    desiredRequirements: null,
    benefits: null,
    workSchedule: "Turno B, 14h–22h",
    salaryRange: null,
    salary: null,
    salaryPublic: true,
    openings: 2,
    openPositions: 2,
    approvedScope: scope as Record<string, unknown>,
    highlightBenefit: null,
    responsible: "Recrutadora",
    hiringManager: "Paulo Gestor",
    requestId: "11111111-1111-1111-1111-111111111111",
    openingReason: "REPLACEMENT",
    slug: "auxiliar-de-expedicao",
    closingDate: null,
    hiringDeadline: null,
    status: "DRAFT",
    visibility: "BOTH",
    templateId: null,
    createdAt: new Date("2026-10-13T10:00:00Z"),
    updatedAt: new Date("2026-10-13T10:00:00Z"),
  } as unknown as Job;
}

function protectedFor(job: Job): Set<string> {
  const scope = job.approvedScope as ApprovedScope;
  const s = new Set<string>(approvedFields(scope));
  if (scope.workSchedule) s.add("workSchedule");
  return s;
}

// ── 1. Criação manual sem modelo ────────────────────────────────────────────────────────

test("1. criação manual sem modelo: rascunho e payload como antes (sem procedência, publicação padrão)", () => {
  const draft = jobToDraft(null, { responsible: "Recrutadora" });
  assert.equal(draft.templateId, null);
  assert.equal(draft.visibility, "BOTH");
  assert.equal(draft.status, "DRAFT");
  const payload = draftToPayload({ ...draft, title: "Vendedor", city: "Curitiba", content: "### Responsabilidades\n\n- Vender" });
  assert.equal(payload.templateId, null);
  assert.equal(payload.title, "Vendedor");
  assert.ok(!("requestId" in payload));
});

// ── 2. Criação manual com modelo ────────────────────────────────────────────────────────

test("2. criação manual com modelo: preenche cargo, dados padrão e conteúdo; não toca no que é da abertura", () => {
  const blank = jobToDraft(null);
  const plan = planTemplate(blank, TEMPLATE, { defaults: NEW_JOB_DEFAULTS });
  assert.equal(plan.needsConfirmation, false, "formulário novo: nada a confirmar");

  const { draft } = applyTemplate(blank, TEMPLATE, "fill", { defaults: NEW_JOB_DEFAULTS });
  assert.equal(draft.title, "Auxiliar de Logística");
  assert.equal(draft.department, "Logística");
  assert.equal(draft.workSchedule, "Seg a Sex, 08h–17h48");
  assert.match(draft.content, /### Responsabilidades\n\n- Separar e conferir pedidos/);
  assert.match(draft.content, /### Requisitos Obrigatórios/);
  assert.match(draft.content, /### Benefícios\n\n- Vale-transporte/);
  assert.equal(draft.templateId, "tpl-aux-log");
  // Da abertura: intocados.
  for (const k of ["status", "visibility", "openingReason", "salaryDigits", "closingDate", "hiringDeadline", "company", "city", "state"] as const) {
    assert.equal(draft[k], blank[k], k);
  }
  assert.equal(draftToPayload({ ...draft, city: "Curitiba" }).templateId, "tpl-aux-log");
});

test("2. o conteúdo gerado é o Markdown do editor atual (### por seção) e converte sem perda", () => {
  const md = templateToMarkdown(TEMPLATE);
  const doc = parseContent(md);
  assert.deepEqual(
    doc.sections.map((s) => s.heading),
    ["Responsabilidades", "Requisitos Obrigatórios", "Requisitos Desejáveis", "Benefícios"]
  );
  assert.ok(doc.sections.every((s) => s.level === 3));
});

// ── 3. Criação a partir de Solicitação sem modelo ───────────────────────────────────────

test("3. vaga da solicitação sem modelo: rascunho carrega os dados da solicitação e o PATCH não leva requestId", () => {
  const job = jobFromRequest();
  const draft = jobToDraft(job);
  assert.equal(draft.title, "Auxiliar de Expedição");
  assert.equal(draft.company, "Matriz");
  assert.equal(draft.openingReason, "REPLACEMENT");
  assert.equal(draft.hiringManager, "Paulo Gestor");
  assert.match(draft.content, /Substituir colaborador desligado/);
  assert.ok(!("requestId" in draftToPayload(draft)));
});

// ── 4/6. Solicitação + modelo: modelo complementa, nunca sobrescreve a solicitação ──────

test("4. solicitação + modelo (vazios): mantém campos da solicitação e completa as seções em branco", () => {
  const job = jobFromRequest();
  const draft = jobToDraft(job);
  const opts = { protectedFields: protectedFor(job) };
  const { draft: next } = applyTemplate(draft, TEMPLATE, "fill", opts);

  assert.equal(next.title, "Auxiliar de Expedição");
  assert.equal(next.department, "Expedição");
  assert.equal(next.workSchedule, "Turno B, 14h–22h");
  // Seção com texto da solicitação fica; as vazias recebem o modelo.
  assert.match(next.content, /### Responsabilidades\n\nSubstituir colaborador desligado no turno B\./);
  assert.doesNotMatch(next.content, /Separar e conferir pedidos/);
  assert.match(next.content, /### Requisitos Obrigatórios\n\n- Ensino médio completo/);
  assert.match(next.content, /### Benefícios\n\n- Vale-transporte/);
  // O título vazio "### Requisitos" do esqueleto foi absorvido por "Requisitos Obrigatórios".
  assert.equal(parseContent(next.content).sections.filter((s) => /^Requisitos$/.test(s.heading)).length, 0);
  // Fora do modelo: intocados.
  for (const k of ["company", "openingReason", "hiringManager", "status", "visibility", "salaryDigits"] as const) {
    assert.equal(next[k], draft[k], k);
  }
});

test("6. modelo NÃO sobrescreve campo da solicitação — nem com 'Substituir'", () => {
  const job = jobFromRequest();
  const draft = jobToDraft(job);
  const opts = { protectedFields: protectedFor(job) };
  const plan = planTemplate(draft, TEMPLATE, opts);
  assert.equal(plan.needsConfirmation, true);
  assert.deepEqual(plan.protectedConflicts.sort(), ["Horário de trabalho", "Título da vaga", "Área / departamento"].sort());

  const { draft: replaced } = applyTemplate(draft, TEMPLATE, "replace", opts);
  assert.equal(replaced.title, "Auxiliar de Expedição");
  assert.equal(replaced.department, "Expedição");
  assert.equal(replaced.workSchedule, "Turno B, 14h–22h");
});

test("6. campo da solicitação vazio pode ser completado pelo modelo", () => {
  const job = { ...jobFromRequest(), department: null, approvedScope: { ...(jobFromRequest().approvedScope as object), department: null } } as unknown as Job;
  const { draft } = applyTemplate(jobToDraft(job), TEMPLATE, "fill", { protectedFields: protectedFor(job) });
  assert.equal(draft.department, "Logística");
});

// ── 5. Vínculo Solicitação ↔ Vaga preservado ────────────────────────────────────────────

test("5. aplicar/trocar/remover modelo nunca mexe no vínculo: o corpo do PATCH não tem requestId", () => {
  const job = jobFromRequest();
  const draft = jobToDraft(job);
  const opts = { protectedFields: protectedFor(job) };
  const applied = applyTemplate(draft, TEMPLATE, "fill", opts).draft;
  const reverted = revertTemplate(applied, draft, applied);
  for (const d of [applied, reverted]) {
    const body = draftToPayload(d) as Record<string, unknown>;
    assert.ok(!("requestId" in body));
    assert.ok(!("approvedScope" in body));
  }
  assert.equal(reverted.templateId, null);
});

// ── 7 (segurança contra sobrescrita) ───────────────────────────────────────────────────

test("conteúdo já digitado pelo RH: pede confirmação; 'campos vazios' preserva, 'substituir' troca", () => {
  const draft = { ...jobToDraft(null), title: "Assistente", content: "### Responsabilidades\n\n- Texto do RH\n\n### Benefícios\n\n" };
  const plan = planTemplate(draft, TEMPLATE, { defaults: NEW_JOB_DEFAULTS });
  assert.equal(plan.needsConfirmation, true);
  assert.deepEqual(plan.content.kept, ["Responsabilidades"]);

  const fill = applyTemplate(draft, TEMPLATE, "fill", { defaults: NEW_JOB_DEFAULTS }).draft;
  assert.equal(fill.title, "Assistente", "título digitado fica");
  assert.match(fill.content, /- Texto do RH/);
  assert.match(fill.content, /- Vale-transporte/, "seção vazia recebe o modelo");

  const replace = applyTemplate(draft, TEMPLATE, "replace", { defaults: NEW_JOB_DEFAULTS }).draft;
  assert.equal(replace.title, "Auxiliar de Logística");
  assert.doesNotMatch(replace.content, /Texto do RH/);
});

test("seções com texto que o modelo não tem são mantidas no fim", () => {
  const merged = mergeTemplateContent("Texto de abertura\n\n### Sobre a WG\n\nSomos uma empresa…", templateToMarkdown(TEMPLATE), "fill");
  assert.ok(merged.startsWith("Texto de abertura"));
  assert.match(merged, /### Sobre a WG\n\nSomos uma empresa…$/);
});

test("Remover/Trocar desfaz só o que o modelo preencheu; edição posterior do RH fica", () => {
  const before = jobToDraft(null);
  const applied = applyTemplate(before, TEMPLATE, "fill", { defaults: NEW_JOB_DEFAULTS }).draft;
  const edited = { ...applied, workSchedule: "12x36" };
  const reverted = revertTemplate(edited, before, applied);
  assert.equal(reverted.title, before.title);
  assert.equal(reverted.content, before.content);
  assert.equal(reverted.workSchedule, "12x36");
  assert.equal(reverted.templateId, null);
});

test("modelo sem valor num campo nunca limpa o campo da vaga", () => {
  const sparse: JobTemplate = { ...TEMPLATE, department: null, workSchedule: null, benefits: null };
  const draft = { ...jobToDraft(null), department: "Comercial", workSchedule: "Seg a Sex" };
  const { draft: next } = applyTemplate(draft, sparse, "replace");
  assert.equal(next.department, "Comercial");
  assert.equal(next.workSchedule, "Seg a Sex");
});

// ── 12/13. Edição e arquivamento do modelo não afetam vagas antigas ─────────────────────

test("12. editar o modelo depois de aplicado não altera a vaga (cópia, sem vínculo vivo)", () => {
  const template = { ...TEMPLATE };
  const { draft: vaga } = applyTemplate(jobToDraft(null), template, "fill", { defaults: NEW_JOB_DEFAULTS });
  const snapshot = JSON.stringify(vaga);

  template.title = "Auxiliar de Logística II";
  template.responsibilities = "- Versão B";
  template.benefits = null;
  assert.equal(JSON.stringify(vaga), snapshot);

  // Novas vagas recebem a versão B.
  const nova = applyTemplate(jobToDraft(null), template, "fill", { defaults: NEW_JOB_DEFAULTS }).draft;
  assert.equal(nova.title, "Auxiliar de Logística II");
  assert.match(nova.content, /Versão B/);
});

test("13. arquivar o modelo não afeta a vaga criada (o conteúdo continua; só a procedência fica)", () => {
  const template = { ...TEMPLATE };
  const { draft: vaga } = applyTemplate(jobToDraft(null), template, "fill", { defaults: NEW_JOB_DEFAULTS });
  template.active = false;
  assert.equal(vaga.templateId, "tpl-aux-log");
  assert.match(vaga.content, /Separar e conferir pedidos/);
});

// ── Salvar como modelo ──────────────────────────────────────────────────────────────────

test("salvar vaga como modelo: guarda o conteúdo INTEIRO, com os títulos do RH, e nunca dados da abertura", () => {
  const job = jobToDraft(jobFromRequest());
  // Markdown livre, como o RH escreve (títulos próprios, negrito, emoji).
  const content = [
    "Você tem facilidade para negociar? O Grupo WG está em busca de um(a) Assistente Comercial.",
    "",
    "## 🎯 O que você vai fazer",
    "",
    "- Atender clientes",
    "",
    "**Benefícios:** VT, VR",
  ].join("\n");
  const t = templateFromJob({ ...job, content }, {
    name: "Assistente Comercial",
    department: "Comercial",
    include: { general: true, content: true },
  });
  assert.equal(t.title, "Auxiliar de Expedição");
  assert.equal(t.about, content);
  assert.equal(templateToMarkdown(t), content, "aplicar o modelo devolve exatamente o texto salvo");
  for (const k of ["responsibilities", "requiredRequirements", "desiredRequirements", "benefits"] as const) assert.equal(t[k], null);
  const keys = Object.keys(t);
  for (const forbidden of ["status", "visibility", "requestId", "openings", "openingReason", "salary", "closingDate", "hiringDeadline", "company"]) {
    assert.ok(!keys.includes(forbidden), forbidden);
  }

  const semConteudo = templateFromJob({ ...job, content }, { name: "X", department: "", include: { general: false, content: false } });
  assert.equal(semConteudo.about, null);
  assert.equal(semConteudo.contractType, null);
  assert.equal(semConteudo.department, null);
});

test("esqueleto vazio da solicitação não vira conteúdo de modelo", () => {
  const job = jobToDraft(null);
  const t = templateFromJob({ ...job, title: "Vendedor" }, { name: "Vendedor", department: "", include: { general: true, content: true } });
  assert.equal(t.about, null);
});

test("modelo antigo (seções separadas) abre no editor como um único Markdown e regrava sem perda", () => {
  const md = templateToMarkdown(TEMPLATE);
  const saved = withContent({ ...TEMPLATE }, md);
  assert.equal(templateToMarkdown(saved), md);
  assert.equal(saved.responsibilities, null);
});

test("aplicar modelo de Markdown livre numa vaga nova copia o texto como está", () => {
  const free: JobTemplate = {
    ...TEMPLATE,
    about: "Texto livre\n\n## Atividades do dia a dia\n\n- Atender",
    responsibilities: null,
    requiredRequirements: null,
    desiredRequirements: null,
    benefits: null,
  };
  const { draft } = applyTemplate(jobToDraft(null), free, "fill", { defaults: NEW_JOB_DEFAULTS });
  assert.equal(draft.content, free.about);
});

// ── Utilitários ─────────────────────────────────────────────────────────────────────────

test("esqueleto só com títulos conta como conteúdo vazio", () => {
  assert.equal(isContentBlank("### Responsabilidades\n\n\n### Requisitos Obrigatórios\n\n"), true);
  assert.equal(isContentBlank("### Responsabilidades\n\n- algo"), false);
});

test("duplicar gera nome sem colisão; busca ignora acento e caixa", () => {
  assert.equal(duplicateName("Vendedor", ["Vendedor"]), "Vendedor (cópia)");
  assert.equal(duplicateName("Vendedor", ["Vendedor", "vendedor (copia)"]), "Vendedor (cópia 2)");
  assert.equal(matchesTemplate(TEMPLATE, "logistica"), true);
  assert.equal(matchesTemplate(TEMPLATE, "comercial"), false);
});
