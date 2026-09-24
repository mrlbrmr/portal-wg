"use client";

import { Panel } from "@/components/ui/Panel";
import { useAdmissionWorkspace } from "./context";
import { DataField, EditableSection, FieldGrid, SourceTag, fieldA11y, inputClass } from "./fields";

// Benefícios e recursos entregues ao colaborador. Hoje o sistema guarda UNIFORME (editável)
// e as respostas de benefícios do formulário (leitura). Novos recursos (crachá, EPI,
// equipamentos, acessos) entram como novos grupos quando existirem no banco — não há
// itens fictícios aqui.

const yesNo = (v: boolean | null) => (v === null ? null : v ? "Sim" : "Não");

export function AdmissionResources() {
  const { data, draft, saved, patch, isEditing } = useAdmissionWorkspace();
  const editing = isEditing("recursos");
  const { answers } = data;
  const fromCandidate = !!data.form.submittedAt;
  const changed = (k: keyof typeof draft) => draft[k] !== saved[k];

  const benefits = [
    {
      label: answers.labels.needsTransportVoucher,
      value: yesNo(answers.needsTransportVoucher),
      detail: answers.needsTransportVoucher && answers.transportVoucherDetails ? answers.transportVoucherDetails : null,
    },
    { label: answers.labels.hasItauAccount, value: yesNo(answers.hasItauAccount), detail: null },
  ].filter((b) => b.value !== null);

  return (
    <div className="flex flex-col gap-5">
      <EditableSection
        section="recursos"
        title="Uniforme"
        meta={fromCandidate ? <SourceTag title="Tamanhos informados no formulário de admissão">Informado pelo candidato</SourceTag> : undefined}
        description={
          answers.noOperationalUniform
            ? "O candidato informou que não usa uniforme operacional (calça e bota) — cargo administrativo."
            : "Tamanhos para separar o uniforme antes do primeiro dia."
        }
      >
        <FieldGrid editing={editing} cols={3}>
          <DataField label="Camiseta" htmlFor="adm-shirt" editing={editing} changed={changed("uniformShirt")} view={draft.uniformShirt || null}>
            <input {...fieldA11y("adm-shirt")} value={draft.uniformShirt} onChange={(e) => patch({ uniformShirt: e.target.value })}
              maxLength={20} placeholder="Ex.: M, G, GG" className={inputClass} />
          </DataField>
          <DataField label="Calça" htmlFor="adm-pants" editing={editing} changed={changed("uniformPants")} view={draft.uniformPants || null}>
            <input {...fieldA11y("adm-pants")} value={draft.uniformPants} onChange={(e) => patch({ uniformPants: e.target.value })}
              maxLength={20} placeholder="Ex.: 40, 42" className={inputClass} />
          </DataField>
          <DataField label="Sapato / bota" htmlFor="adm-shoe" editing={editing} changed={changed("uniformShoe")} view={draft.uniformShoe || null}>
            <input {...fieldA11y("adm-shoe")} value={draft.uniformShoe} onChange={(e) => patch({ uniformShoe: e.target.value })}
              maxLength={20} placeholder="Ex.: 40, 42" className={inputClass} />
          </DataField>
        </FieldGrid>
      </EditableSection>

      <Panel
        title="Benefícios"
        meta={benefits.length > 0 ? <SourceTag>Informado pelo candidato</SourceTag> : undefined}
        description="Respostas do formulário de admissão (somente leitura)."
      >
        {benefits.length > 0 ? (
          <dl className="grid gap-x-6 gap-y-4 pt-2 sm:grid-cols-2">
            {benefits.map((b) => (
              <div key={b.label} className="min-w-0">
                <dt className="text-label text-wg-ink-muted">{b.label}</dt>
                <dd className="mt-0.5 text-body text-wg-ink">{b.value}</dd>
                {b.detail && <dd className="mt-0.5 whitespace-pre-wrap text-meta text-wg-ink-secondary">{b.detail}</dd>}
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-body text-wg-ink-muted">
            {fromCandidate ? "O formulário não trouxe respostas sobre benefícios." : "Aparecem aqui quando o candidato enviar o formulário de admissão."}
          </p>
        )}
      </Panel>
    </div>
  );
}
