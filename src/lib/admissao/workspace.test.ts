// Testes da Central da admissão (workspace.ts): progresso só pelas etapas configuradas,
// pendências só com fatos reais e rascunho compatível com o PATCH existente.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  admissionPendencies,
  admissionProgress,
  admissionToDraft,
  draftToPayload,
  formatDateBR,
  formatSalaryDigits,
  parseAdmissionTab,
  validateDraft,
  type AdmissionRecord,
  type PendencyInput,
} from "./workspace";

const STAGES = [
  { id: "s1", name: "Formulário recebido" },
  { id: "s2", name: "Agendamento de ASO" },
  { id: "s3", name: "Contrato" },
  { id: "s4", name: "Admissão concluída", isFinal: true },
];

const TODAY = new Date("2026-09-24T12:00:00");

function pend(over: Partial<PendencyInput> = {}): PendencyInput {
  return {
    isFinal: false,
    hasStage: true,
    startDate: "2026-10-20",
    medicalExamDate: "2026-10-10",
    cpf: "529.982.247-25",
    formState: "SUBMITTED",
    missingRequiredDocs: [],
    docsToReview: [],
    docsRejected: [],
    ...over,
  };
}

function record(over: Partial<AdmissionRecord> = {}): AdmissionRecord {
  return {
    fullName: "Diogo dos Santos",
    cpf: "52998224725",
    email: "diogo@exemplo.com",
    phone: "41998170054",
    birthDate: "1990-05-02",
    positionId: "p1",
    companyId: "c1",
    branchId: "b1",
    stageId: "s2",
    responsibleId: "u1",
    managerName: "Carlos",
    startDate: "2026-09-28",
    medicalExamDate: null,
    salary: "2800.00",
    shift: "Comercial",
    uniformShirt: "M",
    uniformPants: "40",
    uniformShoe: "40",
    notes: null,
    ...over,
  };
}

describe("admissionProgress", () => {
  it("conta como concluídas as etapas anteriores à atual", () => {
    const p = admissionProgress(STAGES, "s2");
    assert.equal(p.completed, 1);
    assert.equal(p.total, 4);
    assert.equal(p.percent, 25);
    assert.deepEqual(p.steps.map((s) => s.state), ["done", "current", "todo", "todo"]);
    assert.deepEqual(p.next, { id: "s3", name: "Contrato" });
  });

  it("etapa de conclusão = 100% e sem próxima etapa", () => {
    const p = admissionProgress(STAGES, "s4");
    assert.equal(p.isComplete, true);
    assert.equal(p.percent, 100);
    assert.equal(p.completed, 4);
    assert.equal(p.next, null);
    assert.ok(p.steps.every((s) => s.state === "done"));
  });

  it("sem etapa: nada concluído e a próxima é a primeira", () => {
    const p = admissionProgress(STAGES, null);
    assert.equal(p.currentIndex, -1);
    assert.equal(p.completed, 0);
    assert.equal(p.next?.id, "s1");
  });

  it("etapa inativa (fora da jornada) não inventa posição", () => {
    const p = admissionProgress(STAGES, "inativa");
    assert.equal(p.currentIndex, -1);
    assert.equal(p.percent, 0);
  });
});

describe("admissionPendencies", () => {
  it("admissão sem problemas não gera pendência", () => {
    assert.deepEqual(admissionPendencies(pend(), TODAY), []);
  });

  it("admissão concluída nunca mostra pendência", () => {
    assert.deepEqual(admissionPendencies(pend({ isFinal: true, startDate: null, formState: "NOT_SENT" }), TODAY), []);
  });

  it("início próximo sem ASO vira alerta com a contagem real de dias", () => {
    const list = admissionPendencies(pend({ startDate: "2026-09-27", medicalExamDate: null }), TODAY);
    const exam = list.find((p) => p.key === "exam-soon");
    assert.ok(exam);
    assert.equal(exam.tone, "warning");
    assert.match(exam.text, /Início em 3 dias/);
  });

  it("início distante sem ASO é só informativo", () => {
    const list = admissionPendencies(pend({ medicalExamDate: null }), TODAY);
    assert.equal(list.find((p) => p.key === "exam")?.tone, "info");
    assert.equal(list.some((p) => p.key === "exam-soon"), false);
  });

  it("ASO depois do início é sinalizado", () => {
    const list = admissionPendencies(pend({ startDate: "2026-10-01", medicalExamDate: "2026-10-05" }), TODAY);
    assert.ok(list.some((p) => p.key === "exam-after"));
  });

  it("início vencido vem primeiro (danger)", () => {
    const list = admissionPendencies(pend({ startDate: "2026-09-20", formState: "WAITING" }), TODAY);
    assert.equal(list[0].key, "late");
    assert.match(list[0].text, /há 4 dias/);
  });

  it("CPF inválido gravado aparece como pendência", () => {
    const list = admissionPendencies(pend({ cpf: "111.111.111-11" }), TODAY);
    assert.ok(list.some((p) => p.key === "cpf" && p.tab === "dados"));
  });

  it("estados do formulário", () => {
    assert.match(admissionPendencies(pend({ formState: "NOT_SENT" }), TODAY)[0].text, /ainda não foi enviado/);
    assert.equal(admissionPendencies(pend({ formState: "EXPIRED" }), TODAY)[0].tone, "warning");
  });
});

describe("rascunho", () => {
  it("converte o registro em valores de formulário com máscaras", () => {
    const d = admissionToDraft(record());
    assert.equal(d.cpf, "529.982.247-25");
    assert.equal(d.phone, "(41) 99817-0054");
    assert.equal(d.salaryDigits, "280000");
    assert.equal(d.medicalExamDate, "");
  });

  it("payload mantém o contrato do PATCH e não envia a origem", () => {
    const body = draftToPayload(admissionToDraft(record({ salary: 1500.5 })));
    assert.equal(body.salary, "1500.50");
    assert.equal(body.startDate, "2026-09-28");
    assert.equal("sourceJobId" in body, false);
    assert.equal("sourceApplicationId" in body, false);
    assert.equal("salaryDigits" in body, false);
  });

  it("salário vazio vira string vazia (null no schema)", () => {
    assert.equal(draftToPayload(admissionToDraft(record({ salary: null }))).salary, "");
  });

  it("máscara BRL", () => {
    assert.equal(formatSalaryDigits("280000"), "R$ 2.800,00");
    assert.equal(formatSalaryDigits(""), "");
  });

  it("valida CPF só quando alterado", () => {
    const saved = admissionToDraft(record({ cpf: "111.111.111-11" }));
    assert.deepEqual(validateDraft(saved, saved, TODAY), {});
    assert.equal(validateDraft({ ...saved, cpf: "123.456.789-00" }, saved, TODAY).cpf, "CPF inválido.");
    assert.equal(validateDraft({ ...saved, cpf: "123.456" }, saved, TODAY).cpf, "CPF incompleto.");
  });

  it("nome obrigatório, e-mail e nascimento no futuro", () => {
    const saved = admissionToDraft(record());
    const errors = validateDraft({ ...saved, fullName: " a ", email: "x@", birthDate: "2027-01-01" }, saved, TODAY);
    assert.ok(errors.fullName && errors.email && errors.birthDate);
  });
});

describe("utilitários", () => {
  it("formatDateBR não sofre com fuso", () => {
    assert.equal(formatDateBR("2026-09-28"), "28/09/2026");
    assert.equal(formatDateBR("2026-09-28T00:00:00+00:00"), "28/09/2026");
    assert.equal(formatDateBR(null), null);
  });

  it("aba desconhecida cai na Visão geral", () => {
    assert.equal(parseAdmissionTab("documentos"), "documentos");
    assert.equal(parseAdmissionTab("xpto"), "visao-geral");
    assert.equal(parseAdmissionTab(undefined), "visao-geral");
  });
});
