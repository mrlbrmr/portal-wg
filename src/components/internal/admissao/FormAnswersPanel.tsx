"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { getVisibleDocuments, type FormConfig } from "@/lib/admissao/form-config";
import { BOOT_SIZES, PANTS_SIZES, SHIRT_SIZES } from "@/lib/admissao/form-answers";
import { inputClass } from "./workspace/fields";

export interface FormAnswersValues {
  gender: string | null;
  maritalStatus: string | null;
  hasChildren: boolean | null;
  needsTransportVoucher: boolean | null;
  transportVoucherDetails: string | null;
  hasItauAccount: boolean | null;
  bankAgency: string | null;
  bankAccount: string | null;
  colorDeclaration: string | null;
  isDriverOperator: boolean | null;
  uniformShirt: string | null;
  noOperationalUniform: boolean | null;
  uniformPants: string | null;
  uniformShoe: string | null;
  formExtras: Record<string, string> | null;
}

interface Props {
  admissionId: string;
  canManage: boolean;
  submitted: boolean;
  initial: FormAnswersValues;
  formConfig: FormConfig;
  /** Leitura das respostas (renderizada no servidor) — mostrada fora do modo edição. */
  view: ReactNode;
}

type YesNo = "" | "sim" | "nao";
const toYesNo = (v: boolean | null): YesNo => (v === null ? "" : v ? "sim" : "nao");
const fromYesNo = (v: YesNo): boolean | null => (v === "" ? null : v === "sim");

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-wg-ink-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({ id, value, onChange, options }: { id: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">Não informado</option>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function YesNoSelect({ id, value, onChange }: { id: string; value: YesNo; onChange: (v: YesNo) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as YesNo)} className={inputClass}>
      <option value="">Não informado</option>
      <option value="sim">Sim</option>
      <option value="nao">Não</option>
    </select>
  );
}

/**
 * Respostas do formulário de admissão. Em leitura mostra o que o candidato enviou; o RH pode
 * preencher (candidato mandou os documentos por WhatsApp) ou corrigir as respostas.
 */
export function FormAnswersPanel({ admissionId, canManage, submitted, initial, formConfig, view }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState(initial);
  const set = <K extends keyof FormAnswersValues>(k: K, val: FormAnswersValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const extraDefs = getVisibleDocuments(formConfig, {
    gender: v.gender ?? undefined,
    maritalStatus: v.maritalStatus ?? undefined,
    hasChildren: v.hasChildren ?? undefined,
    hasItauAccount: v.hasItauAccount ?? undefined,
    isDriverOperator: v.isDriverOperator ?? undefined,
  }).flatMap((d) => d.extraFields ?? []);

  function open() {
    setV(initial);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admissoes/${admissionId}/digital/answers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notify("error", body.error ?? "Não foi possível salvar as respostas.");
        return;
      }
      notify("success", submitted ? "Respostas atualizadas." : "Formulário preenchido.");
      setEditing(false);
      router.refresh();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <>
        {submitted ? (
          view
        ) : (
          <div className="rounded-card border border-wg-border-lighter bg-white">
            <EmptyState
              icon={ClipboardList}
              compact
              title="O candidato ainda não enviou o formulário de admissão"
              description={
                canManage
                  ? "Se ele mandou os dados e documentos por WhatsApp, preencha as respostas aqui — o formulário passa a Concluído."
                  : "As respostas completas aparecem aqui assim que o formulário for enviado."
              }
              action={
                canManage ? (
                  <Button size="sm" variant="primary" icon={Pencil} onClick={open}>
                    Preencher pelo RH
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}
        {submitted && canManage && (
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="secondary" icon={Pencil} onClick={open}>
              Editar respostas do formulário
            </Button>
          </div>
        )}
      </>
    );
  }

  const L = formConfig.labels;
  return (
    <Panel
      title={submitted ? "Editar respostas do formulário" : "Preencher formulário pelo RH"}
      description={
        submitted
          ? "Corrija apenas o que estiver errado — a alteração fica registrada no histórico. Nome, CPF, e-mail e telefone são editados em “Dados pessoais”, acima."
          : "Use as informações recebidas por WhatsApp. Ao salvar, o formulário passa a Concluído (o RH não recebe e-mail) e o link do candidato deixa de valer. Nome, CPF, e-mail e telefone ficam em “Dados pessoais”, acima."
      }
      className="border-wg-green/60 ring-1 ring-wg-green/20"
      action={
        <Button size="sm" variant="tertiary" icon={X} onClick={() => setEditing(false)} disabled={saving}>
          Cancelar
        </Button>
      }
    >
      <div className="grid gap-x-6 gap-y-4 pt-2 sm:grid-cols-2">
        <Field label="Gênero" htmlFor="fa-gender">
          <Select id="fa-gender" value={v.gender ?? ""} onChange={(x) => set("gender", x || null)} options={formConfig.genderOptions} />
        </Field>
        <Field label={L.maritalStatus} htmlFor="fa-marital">
          <Select id="fa-marital" value={v.maritalStatus ?? ""} onChange={(x) => set("maritalStatus", x || null)} options={formConfig.maritalOptions} />
        </Field>
        <Field label={L.hasChildren} htmlFor="fa-children">
          <YesNoSelect id="fa-children" value={toYesNo(v.hasChildren)} onChange={(x) => set("hasChildren", fromYesNo(x))} />
        </Field>
        <Field label={L.colorDeclaration} htmlFor="fa-color">
          <Select id="fa-color" value={v.colorDeclaration ?? ""} onChange={(x) => set("colorDeclaration", x || null)} options={formConfig.colorOptions} />
        </Field>
        <Field label={L.needsTransportVoucher} htmlFor="fa-vt">
          <YesNoSelect id="fa-vt" value={toYesNo(v.needsTransportVoucher)} onChange={(x) => set("needsTransportVoucher", fromYesNo(x))} />
        </Field>
        {v.needsTransportVoucher && (
          <Field label={L.transportVoucherDetails} htmlFor="fa-vt-details">
            <input
              id="fa-vt-details"
              value={v.transportVoucherDetails ?? ""}
              onChange={(e) => set("transportVoucherDetails", e.target.value)}
              maxLength={500}
              className={inputClass}
            />
          </Field>
        )}
        <Field label={L.hasItauAccount} htmlFor="fa-itau">
          <YesNoSelect id="fa-itau" value={toYesNo(v.hasItauAccount)} onChange={(x) => set("hasItauAccount", fromYesNo(x))} />
        </Field>
        {v.hasItauAccount && (
          <>
            <Field label="Agência Itaú" htmlFor="fa-agency">
              <input id="fa-agency" value={v.bankAgency ?? ""} onChange={(e) => set("bankAgency", e.target.value)} maxLength={20} className={inputClass} />
            </Field>
            <Field label="Conta Itaú" htmlFor="fa-account">
              <input id="fa-account" value={v.bankAccount ?? ""} onChange={(e) => set("bankAccount", e.target.value)} maxLength={30} className={inputClass} />
            </Field>
          </>
        )}
        <Field label={L.isDriverOperator} htmlFor="fa-driver">
          <YesNoSelect id="fa-driver" value={toYesNo(v.isDriverOperator)} onChange={(x) => set("isDriverOperator", fromYesNo(x))} />
        </Field>
        <Field label="Tamanho da camiseta" htmlFor="fa-shirt">
          <Select id="fa-shirt" value={v.uniformShirt ?? ""} onChange={(x) => set("uniformShirt", x || null)} options={SHIRT_SIZES} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-wg-ink-secondary sm:col-span-2">
          <input
            type="checkbox"
            checked={!!v.noOperationalUniform}
            onChange={(e) => set("noOperationalUniform", e.target.checked)}
            className="h-4 w-4 accent-wg-green"
          />
          Não utiliza calça e bota (cargo administrativo)
        </label>
        {!v.noOperationalUniform && (
          <>
            <Field label="Tamanho da calça" htmlFor="fa-pants">
              <Select id="fa-pants" value={v.uniformPants ?? ""} onChange={(x) => set("uniformPants", x || null)} options={PANTS_SIZES} />
            </Field>
            <Field label="Número da bota" htmlFor="fa-boot">
              <Select id="fa-boot" value={v.uniformShoe ?? ""} onChange={(x) => set("uniformShoe", x || null)} options={BOOT_SIZES} />
            </Field>
          </>
        )}
        {extraDefs.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={`fa-extra-${f.key}`}>
            <input
              id={`fa-extra-${f.key}`}
              value={v.formExtras?.[f.key] ?? ""}
              onChange={(e) => set("formExtras", { ...(v.formExtras ?? {}), [f.key]: e.target.value })}
              placeholder={f.placeholder}
              maxLength={200}
              className={inputClass}
            />
          </Field>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-wg-border-lighter pt-4">
        <Button size="sm" variant="tertiary" onClick={() => setEditing(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" variant="primary" loading={saving} onClick={save}>
          {submitted ? "Salvar respostas" : "Salvar e concluir formulário"}
        </Button>
      </div>
    </Panel>
  );
}
