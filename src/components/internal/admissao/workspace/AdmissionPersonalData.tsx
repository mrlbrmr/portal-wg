"use client";

import type { ReactNode } from "react";
import { formatDateBR, maskCpf, maskPhone } from "@/lib/admissao/workspace";
import { useAdmissionWorkspace } from "./context";
import { DataField, EditableSection, FieldGrid, SourceTag, fieldA11y, inputClass } from "./fields";

function fmtSubmitted(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", " às");
}

/**
 * Dados pessoais. Quando o candidato já enviou o formulário, estes campos são DELE:
 * ficam em leitura por padrão e a edição avisa que é uma correção (fica no histórico).
 */
export function AdmissionPersonalData({ formAnswers }: { formAnswers: ReactNode }) {
  const { data, draft, saved, patch, errors, isEditing } = useAdmissionWorkspace();
  const editing = isEditing("pessoais");
  const fromCandidate = !!data.form.submittedAt;
  const changed = (k: keyof typeof draft) => draft[k] !== saved[k];

  return (
    <div className="flex flex-col gap-5">
      <EditableSection
        section="pessoais"
        title="Dados pessoais"
        meta={fromCandidate ? <SourceTag>Informado pelo candidato</SourceTag> : undefined}
        description={
          fromCandidate
            ? `Informações enviadas pelo candidato no formulário de admissão em ${fmtSubmitted(data.form.submittedAt!)}.`
            : "Cadastrados pelo RH. O candidato confirma ou corrige estes dados ao enviar o formulário de admissão."
        }
        editLabel="Editar informações"
        editNotice={
          fromCandidate
            ? "Você está alterando dados informados pelo candidato. Corrija apenas o que estiver errado — a alteração fica registrada no histórico."
            : undefined
        }
      >
        <FieldGrid editing={editing}>
          <DataField
            label="Nome completo"
            htmlFor="adm-fullName"
            editing={editing}
            required
            view={draft.fullName || null}
            changed={changed("fullName")}
            error={errors.fullName}
            className="sm:col-span-2"
          >
            <input
              {...fieldA11y("adm-fullName", errors.fullName)}
              value={draft.fullName}
              onChange={(e) => patch({ fullName: e.target.value })}
              maxLength={120}
              autoComplete="off"
              className={inputClass}
            />
          </DataField>
          <DataField label="CPF" htmlFor="adm-cpf" editing={editing} view={draft.cpf || null} changed={changed("cpf")} error={errors.cpf}>
            <input
              {...fieldA11y("adm-cpf", errors.cpf)}
              value={draft.cpf}
              onChange={(e) => patch({ cpf: maskCpf(e.target.value) })}
              inputMode="numeric"
              placeholder="000.000.000-00"
              autoComplete="off"
              className={inputClass}
            />
          </DataField>
          <DataField
            label="Data de nascimento"
            htmlFor="adm-birthDate"
            editing={editing}
            view={formatDateBR(draft.birthDate)}
            changed={changed("birthDate")}
            error={errors.birthDate}
          >
            <input
              {...fieldA11y("adm-birthDate", errors.birthDate)}
              type="date"
              value={draft.birthDate}
              onChange={(e) => patch({ birthDate: e.target.value })}
              className={inputClass}
            />
          </DataField>
          <DataField label="E-mail" htmlFor="adm-email" editing={editing} view={draft.email || null} changed={changed("email")} error={errors.email}>
            <input
              {...fieldA11y("adm-email", errors.email)}
              type="email"
              value={draft.email}
              onChange={(e) => patch({ email: e.target.value })}
              maxLength={150}
              placeholder="email@exemplo.com"
              autoComplete="off"
              className={inputClass}
            />
          </DataField>
          <DataField label="Telefone" htmlFor="adm-phone" editing={editing} view={draft.phone || null} changed={changed("phone")} error={errors.phone}>
            <input
              {...fieldA11y("adm-phone", errors.phone)}
              type="tel"
              value={draft.phone}
              onChange={(e) => patch({ phone: maskPhone(e.target.value) })}
              inputMode="tel"
              placeholder="(00) 00000-0000"
              autoComplete="off"
              className={inputClass}
            />
          </DataField>
        </FieldGrid>
      </EditableSection>

      {/* Respostas completas do formulário (somente leitura; o componente já traz o card). */}
      {formAnswers}
    </div>
  );
}
