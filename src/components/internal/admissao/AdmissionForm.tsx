"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Trash2 } from "lucide-react";

export interface AdmissionFormValues {
  fullName: string;
  cpf: string;
  email: string;
  phone: string;
  birthDate: string;
  positionId: string;
  companyId: string;
  branchId: string;
  stageId: string;
  templateId: string;
  responsibleId: string;
  managerName: string;
  startDate: string;
  medicalExamDate: string;
  salary: string;
  shift: string;
  uniformShirt: string;
  uniformPants: string;
  uniformShoe: string;
  notes: string;
}

interface Option {
  id: string;
  name: string;
}

interface Props {
  options: {
    stages: Option[];
    companies: Option[];
    branches: Option[];
    positions: Option[];
    templates: Option[];
    users: Option[];
  };
  admission?: AdmissionFormValues & { id: string };
  canDelete?: boolean;
}

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatSalary(raw: string): string {
  const num = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  if (isNaN(num)) return raw;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseSalary(formatted: string): string {
  return formatted.replace(/\./g, "").replace(",", ".");
}
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

function SelectField({
  name,
  label,
  options,
  defaultValue,
  placeholder = "— selecione —",
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} className={inputClass}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdmissionForm({ options, admission, canDelete }: Props) {
  const router = useRouter();
  const isEdit = !!admission;
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cpf, setCpf] = useState(() => maskCpf(admission?.cpf ?? ""));
  const [phone, setPhone] = useState(() => maskPhone(admission?.phone ?? ""));
  const [salary, setSalary] = useState(() => {
    if (!admission?.salary) return "";
    // admission.salary vem do DB como "1500.00" (ponto decimal US) — parseFloat direto
    const num = parseFloat(admission.salary);
    return isNaN(num) ? "" : num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    if (typeof payload.salary === "string" && payload.salary) {
      payload.salary = parseSalary(payload.salary as string);
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        isEdit ? `/api/admissoes/${admission!.id}` : "/api/admissoes",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        let message = "Não foi possível salvar a admissão.";
        try {
          const j = await res.json();
          if (typeof j.error === "string") message = j.error;
        } catch {
          /* mantém a mensagem padrão */
        }
        setError(message);
        return;
      }

      setSaved(true);
      router.push("/admissoes");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!admission) return;
    if (!confirm("Excluir esta admissão? Esta ação pode ser desfeita apenas pelo suporte.")) return;
    setError(null);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admissoes/${admission.id}`, { method: "DELETE" });
      if (!res.ok) {
        let message = "Não foi possível excluir.";
        try {
          const j = await res.json();
          if (typeof j.error === "string") message = j.error;
        } catch {
          /* padrão */
        }
        setError(message);
        return;
      }
      router.push("/admissoes");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  }

  const v = admission;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Dados pessoais */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-900 mb-1">Dados pessoais</legend>
        <div>
          <label htmlFor="fullName" className={labelClass}>
            Nome completo <span className="text-red-500">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            defaultValue={v?.fullName ?? ""}
            placeholder="Nome do colaborador"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cpf" className={labelClass}>
              CPF
            </label>
            <input id="cpf" name="cpf" type="text" inputMode="numeric" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" className={inputClass} />
          </div>
          <div>
            <label htmlFor="birthDate" className={labelClass}>
              Data de nascimento
            </label>
            <input id="birthDate" name="birthDate" type="date" defaultValue={v?.birthDate ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>
              E-mail
            </label>
            <input id="email" name="email" type="email" defaultValue={v?.email ?? ""} placeholder="email@exemplo.com" className={inputClass} />
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>
              Telefone
            </label>
            <input id="phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(00) 0 0000-0000" className={inputClass} />
          </div>
        </div>
      </fieldset>

      {/* Cargo e lotação */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-900 mb-1">Cargo e lotação</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SelectField name="positionId" label="Cargo" options={options.positions} defaultValue={v?.positionId} />
          <SelectField name="companyId" label="Empresa" options={options.companies} defaultValue={v?.companyId} />
          <SelectField name="branchId" label="Filial" options={options.branches} defaultValue={v?.branchId} />
        </div>
      </fieldset>

      {/* Processo */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-900 mb-1">Processo de admissão</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SelectField name="stageId" label="Etapa" options={options.stages} defaultValue={v?.stageId} />
          <SelectField name="responsibleId" label="Responsável" options={options.users} defaultValue={v?.responsibleId} />
          <SelectField name="templateId" label="Modelo de checklist" options={options.templates} defaultValue={v?.templateId} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className={labelClass}>
              Data de início
            </label>
            <input id="startDate" name="startDate" type="date" defaultValue={v?.startDate ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="medicalExamDate" className={labelClass}>
              Exame médico (ASO)
            </label>
            <input id="medicalExamDate" name="medicalExamDate" type="date" defaultValue={v?.medicalExamDate ?? ""} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="salary" className={labelClass}>
              Salário (R$)
            </label>
            <input id="salary" name="salary" type="text" inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} onBlur={(e) => { if (e.target.value) setSalary(formatSalary(e.target.value)); }} placeholder="0,00" className={inputClass} />
          </div>
          <div>
            <label htmlFor="shift" className={labelClass}>
              Turno
            </label>
            <input id="shift" name="shift" type="text" defaultValue={v?.shift ?? ""} placeholder="Ex.: Comercial" className={inputClass} />
          </div>
          <div>
            <label htmlFor="managerName" className={labelClass}>
              Gestor
            </label>
            <input id="managerName" name="managerName" type="text" defaultValue={v?.managerName ?? ""} placeholder="Nome do gestor" className={inputClass} />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Uniforme</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="uniformShirt" className={labelClass}>Camiseta</label>
              <input id="uniformShirt" name="uniformShirt" type="text" defaultValue={v?.uniformShirt ?? ""} placeholder="Ex.: M, G, GG" className={inputClass} />
            </div>
            <div>
              <label htmlFor="uniformPants" className={labelClass}>Calça</label>
              <input id="uniformPants" name="uniformPants" type="text" defaultValue={v?.uniformPants ?? ""} placeholder="Ex.: 40, 42" className={inputClass} />
            </div>
            <div>
              <label htmlFor="uniformShoe" className={labelClass}>Sapato</label>
              <input id="uniformShoe" name="uniformShoe" type="text" defaultValue={v?.uniformShoe ?? ""} placeholder="Ex.: 40, 42" className={inputClass} />
            </div>
          </div>
        </div>
      </fieldset>

      {/* Observações */}
      <fieldset>
        <label htmlFor="notes" className={labelClass}>
          Observações
        </label>
        <textarea id="notes" name="notes" rows={4} defaultValue={v?.notes ?? ""} placeholder="Anotações internas sobre a admissão…" className={inputClass} />
      </fieldset>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          {isEdit && canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isLoading}
              className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Excluir
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admissoes")}
            className="px-4 py-2.5 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading || isDeleting}
            className="inline-flex items-center justify-center gap-2 bg-wg-green hover:bg-wg-green-bright disabled:opacity-60 text-black font-semibold px-6 py-2.5 rounded-full transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Salvando…
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" /> Salvo
              </>
            ) : isEdit ? (
              "Salvar alterações"
            ) : (
              "Criar admissão"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
