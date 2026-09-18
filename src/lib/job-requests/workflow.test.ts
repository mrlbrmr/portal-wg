// Testes do domínio SOLICITAÇÃO → VALIDAÇÃO RH → APROVAÇÃO → PROCESSO SELETIVO.
//
// Runner: `node:test` nativo, executado pelo tsx (`npm test`). Nenhuma dependência nova —
// o projeto não tinha runner de testes e a stack já resolve isso.
//
// O alvo é workflow.ts, o módulo puro consultado TANTO pela UI (para decidir quais botões
// mostrar) QUANTO pelo service (para autorizar a escrita). Testar aqui cobre os dois lados.
//
// O que NÃO é testado aqui, e por quê: a unicidade da vaga por solicitação é garantida no
// banco (`create_job_from_request` faz `select ... for update` e falha se `job_id` já
// existir) — a checagem correspondente no workflow é o caso 7 abaixo.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableActions,
  canRunAction,
  CRITICAL_FIELDS,
  evaluateEdit,
  findCriticalChanges,
  REAPPROVAL_WARNING,
  type WorkflowActor,
  type WorkflowRequest,
} from "./workflow";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const GESTOR: WorkflowActor = {
  userId: "u-gestor",
  name: "Daniel (gestor)",
  role: "VIEWER_RH",
  isApprover: false,
};

const RH: WorkflowActor = {
  userId: "u-rh",
  name: "Murilo (RH)",
  role: "ADMIN_RH",
  isApprover: false,
};

const APROVADOR: WorkflowActor = {
  userId: "u-diretor",
  name: "Diretor",
  role: "VIEWER_RH",
  isApprover: true,
};

/** Usuário sem nada a ver com a solicitação. */
const TERCEIRO: WorkflowActor = {
  userId: "u-terceiro",
  name: "Outro",
  role: "VIEWER_RH",
  isApprover: true,
};

function request(over: Partial<WorkflowRequest> = {}): WorkflowRequest {
  return {
    status: "DRAFT",
    requestedByUserId: GESTOR.userId,
    currentApproverUserId: null,
    jobId: null,
    ...over,
  };
}

// ─── 1–5: o caminho feliz completo ────────────────────────────────────────────

describe("fluxo principal", () => {
  it("1. gestor cria a solicitação e ela nasce em Rascunho, editável por ele", () => {
    const req = request({ status: "DRAFT" });
    const decision = evaluateEdit(req, GESTOR, []);
    assert.equal(decision.allowed, true);
    assert.equal(availableActions(req, GESTOR).some((a) => a.id === "SUBMIT"), true);
  });

  it("2. gestor envia para o RH (DRAFT → PENDING_HR)", () => {
    const req = request({ status: "DRAFT" });
    assert.equal(canRunAction("SUBMIT", req, GESTOR).ok, true);
    assert.equal(canRunAction("SUBMIT", req, TERCEIRO).ok, false);
  });

  it("3. RH valida e encaminha (PENDING_HR → PENDING_APPROVAL)", () => {
    const req = request({ status: "PENDING_HR" });
    assert.equal(canRunAction("HR_VALIDATE", req, RH).ok, true);
    // O gestor não valida a própria solicitação.
    assert.equal(canRunAction("HR_VALIDATE", req, GESTOR).ok, false);
  });

  it("4. aprovador aprova (PENDING_APPROVAL → APPROVED)", () => {
    const req = request({
      status: "PENDING_APPROVAL",
      currentApproverUserId: APROVADOR.userId,
    });
    assert.equal(canRunAction("APPROVE", req, APROVADOR).ok, true);
  });

  it("5. RH cria o processo seletivo a partir da solicitação aprovada", () => {
    const req = request({ status: "APPROVED" });
    assert.equal(canRunAction("START_RECRUITMENT", req, RH).ok, true);
  });
});

// ─── 6–7: as duas travas da criação da vaga ───────────────────────────────────

describe("criação do processo seletivo", () => {
  it("6. não é possível criar vaga sem aprovação", () => {
    for (const status of ["DRAFT", "PENDING_HR", "PENDING_APPROVAL", "RETURNED"] as const) {
      const verdict = canRunAction("START_RECRUITMENT", request({ status }), RH);
      assert.equal(verdict.ok, false, `status ${status} não deveria liberar o recrutamento`);
      assert.equal(verdict.ok === false && verdict.reason, "STATUS");
    }
  });

  it("6b. solicitação reprovada ou cancelada nunca gera processo seletivo", () => {
    for (const status of ["REJECTED", "CANCELLED"] as const) {
      assert.equal(canRunAction("START_RECRUITMENT", request({ status }), RH).ok, false);
    }
  });

  it("7. não é possível criar duas vagas a partir da mesma solicitação", () => {
    // Já virou vaga: o status é RECRUITING e job_id está preenchido.
    const jaCriada = request({ status: "RECRUITING", jobId: "job-1" });
    assert.equal(canRunAction("START_RECRUITMENT", jaCriada, RH).ok, false);

    // E mesmo num APPROVED com job_id (estado transitório), a trava de jobId pega.
    const comVaga = request({ status: "APPROVED", jobId: "job-1" });
    const verdict = canRunAction("START_RECRUITMENT", comVaga, RH);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.ok === false && verdict.reason, "ALREADY_RECRUITING");
  });
});

// ─── 8–9: comentário obrigatório ──────────────────────────────────────────────

describe("comentário obrigatório", () => {
  it("8. devolver exige comentário (RH e aprovador)", () => {
    const paraRh = request({ status: "PENDING_HR" });
    assert.equal(canRunAction("HR_RETURN", paraRh, RH, "").ok, false);
    assert.equal(canRunAction("HR_RETURN", paraRh, RH, "   ").ok, false);
    assert.equal(canRunAction("HR_RETURN", paraRh, RH, "Faltou o centro de custo.").ok, true);

    const paraAprovador = request({
      status: "PENDING_APPROVAL",
      currentApproverUserId: APROVADOR.userId,
    });
    const semComentario = canRunAction("APPROVER_RETURN", paraAprovador, APROVADOR, null);
    assert.equal(semComentario.ok, false);
    assert.equal(semComentario.ok === false && semComentario.reason, "COMMENT");
  });

  it("9. reprovar exige comentário", () => {
    const req = request({
      status: "PENDING_APPROVAL",
      currentApproverUserId: APROVADOR.userId,
    });
    assert.equal(canRunAction("REJECT", req, APROVADOR, "").ok, false);
    assert.equal(canRunAction("REJECT", req, APROVADOR, "Sem orçamento em 2026.").ok, true);
  });

  it("9b. aprovar aceita comentário vazio (é opcional)", () => {
    const req = request({
      status: "PENDING_APPROVAL",
      currentApproverUserId: APROVADOR.userId,
    });
    assert.equal(canRunAction("APPROVE", req, APROVADOR, "").ok, true);
  });
});

// ─── 10: permissões ───────────────────────────────────────────────────────────

describe("permissões", () => {
  it("10. usuário sem permissão não consegue aprovar", () => {
    const req = request({
      status: "PENDING_APPROVAL",
      currentApproverUserId: APROVADOR.userId,
    });

    // Não é o aprovador da vez.
    const outro = canRunAction("APPROVE", req, TERCEIRO);
    assert.equal(outro.ok, false);
    assert.equal(outro.ok === false && outro.reason, "PERMISSION");

    // O gestor solicitante também não aprova o próprio pedido.
    assert.equal(canRunAction("APPROVE", req, GESTOR).ok, false);

    // O designado aprova; e o ADMIN pode tudo (regra 14).
    assert.equal(canRunAction("APPROVE", req, APROVADOR).ok, true);
    assert.equal(canRunAction("APPROVE", req, RH).ok, true);
  });

  it("10b. a UI só oferece ações que o servidor aceitaria", () => {
    const req = request({
      status: "PENDING_APPROVAL",
      currentApproverUserId: APROVADOR.userId,
    });
    const ids = availableActions(req, APROVADOR).map((a) => a.id);
    assert.deepEqual(ids.sort(), ["APPROVER_RETURN", "APPROVE", "REJECT"].sort());

    // Terceiro sem vínculo não vê nada para fazer.
    assert.deepEqual(availableActions(req, TERCEIRO), []);
  });

  it("10c. solicitação devolvida volta a ser editável pelo solicitante (regra 15)", () => {
    const req = request({ status: "RETURNED" });
    assert.equal(evaluateEdit(req, GESTOR, []).allowed, true);
    assert.equal(canRunAction("SUBMIT", req, GESTOR).ok, true);
    // Mas não por um terceiro qualquer.
    assert.equal(evaluateEdit(req, TERCEIRO, []).allowed, false);
  });
});

// ─── 11: campos críticos e reaprovação ────────────────────────────────────────

describe("campos críticos", () => {
  const aprovada = request({ status: "APPROVED" });

  it("11. alterar campo crítico depois da aprovação dispara nova aprovação", () => {
    const changed = findCriticalChanges({ openings: 1 }, { openings: 3 });
    assert.deepEqual(changed, ["openings"]);

    const decision = evaluateEdit(aprovada, RH, changed);
    assert.equal(decision.allowed, true);
    assert.equal(decision.allowed && decision.requiresReapproval, true);
    assert.equal(
      decision.allowed && decision.requiresReapproval && decision.warning,
      REAPPROVAL_WARNING
    );
  });

  it("11b. campo operacional não dispara reaprovação", () => {
    // `justification` e `workSchedule` não estão na lista de campos críticos.
    const changed = findCriticalChanges(
      { title: "Analista" },
      { title: "Analista", justification: "texto novo", workSchedule: "12x36" } as Record<
        string,
        unknown
      >
    );
    assert.deepEqual(changed, []);
    const decision = evaluateEdit(aprovada, RH, changed);
    assert.equal(decision.allowed && decision.requiresReapproval, false);
  });

  it("11c. a lista de campos críticos é a acordada com o negócio", () => {
    // Faixa salarial, centro de custo e orçamento/headcount saíram: a solicitação não
    // coleta esses dados (salário é definido pelo RH na vaga; headcount é externo).
    assert.deepEqual([...CRITICAL_FIELDS].sort(), [
      "contractType",
      "location",
      "openings",
      "reasonType",
      "title",
    ]);
  });

  it("11d. comparação é tolerante a tipo (3 e \"3\" são o mesmo valor)", () => {
    assert.deepEqual(findCriticalChanges({ openings: 3 }, { openings: "3" }), []);
    assert.deepEqual(findCriticalChanges({ location: null }, { location: "" }), []);
    assert.deepEqual(findCriticalChanges({ location: null }, { location: "Matriz" }), [
      "location",
    ]);
  });

  it("11e. com a vaga já criada, campo crítico não pode mais ser alterado", () => {
    const emRecrutamento = request({ status: "RECRUITING", jobId: "job-1" });
    const decision = evaluateEdit(emRecrutamento, RH, ["contractType"]);
    assert.equal(decision.allowed, false);
  });

  it("11f. reprovada/cancelada não é editável — precisa reabrir antes", () => {
    for (const status of ["REJECTED", "CANCELLED"] as const) {
      assert.equal(evaluateEdit(request({ status }), RH, []).allowed, false);
      assert.equal(canRunAction("REOPEN", request({ status }), RH).ok, true);
    }
  });
});

// ─── 12: histórico ────────────────────────────────────────────────────────────

describe("histórico", () => {
  it("12. toda transição tem origem e destino declarados (base do histórico)", () => {
    // O service grava from_status/to_status a partir da definição da ação; se uma ação
    // ficasse sem `from` ou sem `to`, o histórico nasceria incompleto.
    const req = request({ status: "PENDING_HR" });
    for (const action of availableActions(req, RH)) {
      assert.ok(action.from.length > 0, `${action.id} sem status de origem`);
      assert.ok(action.to, `${action.id} sem status de destino`);
      assert.ok(action.label.length > 0, `${action.id} sem rótulo`);
    }
  });

  it("12b. ações destrutivas pedem confirmação e comentário", () => {
    const req = request({ status: "PENDING_APPROVAL", currentApproverUserId: RH.userId });
    const porId = Object.fromEntries(availableActions(req, RH).map((a) => [a.id, a]));
    assert.equal(porId.REJECT.confirm, true);
    assert.equal(porId.REJECT.requiresComment, true);
    assert.equal(porId.CANCEL.confirm, true);
    assert.equal(porId.CANCEL.requiresComment, true);
    assert.equal(porId.APPROVE.confirm, false);
  });
});

// ─── 13: compatibilidade com o legado ─────────────────────────────────────────

describe("compatibilidade", () => {
  it("13. vaga legada (sem solicitação) não é tocada pelo workflow", () => {
    // Uma vaga sem request_id simplesmente não tem WorkflowRequest associado: não há
    // transição possível, nada a validar. O que garantimos aqui é que o workflow não
    // presume solicitante nem aprovador para operar.
    const semSolicitante = request({
      status: "PENDING_HR",
      requestedByUserId: null,
      currentApproverUserId: null,
    });
    assert.equal(canRunAction("HR_VALIDATE", semSolicitante, RH).ok, true);
    assert.equal(canRunAction("HR_RETURN", semSolicitante, RH, "ajustar").ok, true);
    // E um anônimo (sem userId) não vira "solicitante" por coincidência de null.
    const anonimo: WorkflowActor = {
      userId: null,
      name: "anônimo",
      role: "VIEWER_RH",
      isApprover: false,
    };
    assert.equal(canRunAction("SUBMIT", request({ requestedByUserId: null }), anonimo).ok, false);
  });
});
