import { getVisibleDocuments, type FormConfig, type FormAnswers } from "@/lib/admissao/form-config";

export interface DigitalFormData {
  fullName: string;
  cpf: string | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
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
  submittedAt: string;
}

interface Props {
  data: DigitalFormData;
  formConfig: FormConfig;
}

function fmtCpf(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  if (d.length !== 11) return v;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function fmtPhone(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

function fmtDate(v: string | null): string | null {
  return v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null;
}

function bool(v: boolean | null, yes = "Sim", no = "Não"): string | null {
  if (v === null || v === undefined) return null;
  return v ? yes : no;
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[#6B7860] text-[11px]">{label}</span>
      <span className="text-[#1A2213] text-sm font-semibold">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[#6B7860] text-[11px] tracking-[.07em] uppercase font-bold border-b border-[#F2F5EE] pb-1.5">
        {title}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  );
}

export function DigitalFormViewer({ data, formConfig }: Props) {
  const submittedDt = new Date(data.submittedAt).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

  const answers: Partial<FormAnswers> = {
    gender: data.gender ?? undefined,
    maritalStatus: data.maritalStatus ?? undefined,
    hasChildren: data.hasChildren ?? undefined,
    hasItauAccount: data.hasItauAccount ?? undefined,
    isDriverOperator: data.isDriverOperator ?? undefined,
  };

  const visibleDocs = getVisibleDocuments(formConfig, answers);
  const extraFieldDefs = formConfig.documents.flatMap((d) => d.extraFields ?? []);
  const extraRows = data.formExtras
    ? Object.entries(data.formExtras)
        .map(([k, v]) => ({ label: extraFieldDefs.find((f) => f.key === k)?.label ?? k, value: v }))
        .filter((r) => r.value)
    : [];

  return (
    <div className="bg-white border border-[#E7EEDD] rounded-2xl p-5 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="text-[#6B7860] text-[11px] tracking-[.07em] uppercase font-bold">
          Formulário digital
        </div>
        <span className="text-xs text-[#6B7860]">Enviado em {submittedDt}</span>
      </div>

      <Section title="Dados Pessoais">
        <Row label="Nome completo" value={data.fullName} />
        <Row label="CPF" value={fmtCpf(data.cpf)} />
        <Row label="Data de nascimento" value={fmtDate(data.birthDate)} />
        <Row label="E-mail" value={data.email} />
        <Row label="Telefone / WhatsApp" value={fmtPhone(data.phone)} />
        <Row label="Gênero" value={data.gender} />
      </Section>

      <Section title="Informações Adicionais">
        <Row label={formConfig.labels.maritalStatus} value={data.maritalStatus} />
        <Row label={formConfig.labels.hasChildren} value={bool(data.hasChildren)} />
        <Row label={formConfig.labels.needsTransportVoucher} value={bool(data.needsTransportVoucher)} />
        {data.needsTransportVoucher && data.transportVoucherDetails && (
          <Row label={formConfig.labels.transportVoucherDetails} value={data.transportVoucherDetails} />
        )}
        <Row label={formConfig.labels.hasItauAccount} value={bool(data.hasItauAccount)} />
        {data.hasItauAccount && (
          <>
            <Row label="Agência Itaú" value={data.bankAgency} />
            <Row label="Conta Itaú" value={data.bankAccount} />
          </>
        )}
        <Row label={formConfig.labels.colorDeclaration} value={data.colorDeclaration} />
        <Row label={formConfig.labels.isDriverOperator} value={bool(data.isDriverOperator)} />
      </Section>

      {data.uniformShirt && (
        <Section title="Uniformes">
          <Row label="Camiseta" value={data.uniformShirt} />
          {data.noOperationalUniform
            ? <Row label="Calça / Bota" value="Não utiliza (cargo adm.)" />
            : <>
                <Row label="Calça" value={data.uniformPants} />
                <Row label="Bota"  value={data.uniformShoe} />
              </>
          }
        </Section>
      )}

      {extraRows.length > 0 && (
        <Section title="Dados do Documento">
          {extraRows.map((r) => (
            <Row key={r.label} label={r.label} value={r.value} />
          ))}
        </Section>
      )}

      <div className="flex flex-col gap-3">
        <div className="text-[#6B7860] text-[11px] tracking-[.07em] uppercase font-bold border-b border-[#F2F5EE] pb-1.5">
          Documentos exigidos no formulário
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleDocs.map((doc) => (
            <span
              key={doc.key}
              className="inline-flex items-center gap-1.5 bg-[#F2F5EE] text-[#3E4A34] text-xs font-medium px-2.5 py-1 rounded-full"
            >
              {doc.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
