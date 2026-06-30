"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAZIL_STATES } from "@/lib/utils";
import { Loader2, Check } from "lucide-react";
import { RichTextEditor } from "@/components/internal/RichTextEditor";
import type { Job } from "@prisma/client";

interface Props {
  job?: Job;
}

const inputClass =
  "w-full bg-wg-card-2 border border-wg-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-wg-gray focus:outline-none focus:ring-2 focus:ring-wg-green/40 transition-colors";

const labelClass = "block text-sm font-medium text-wg-gray mb-1";

export default function JobForm({ job }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [richFields, setRichFields] = useState({
    description: job?.description ?? "",
    responsibilities: job?.responsibilities ?? "",
    requiredRequirements: job?.requiredRequirements ?? "",
    desiredRequirements: job?.desiredRequirements ?? "",
    benefits: job?.benefits ?? "",
  });

  // Novos campos opcionais do card
  const [salaryRange, setSalaryRange] = useState(job?.salaryRange ?? "");
  const [highlightBenefit, setHighlightBenefit] = useState(
    job?.highlightBenefit ?? ""
  );

  function setRich(key: keyof typeof richFields) {
    return (html: string) => setRichFields((prev) => ({ ...prev, [key]: html }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const body = {
      title: formData.get("title"),
      department: formData.get("department") || undefined,
      company: formData.get("company") || undefined,
      city: formData.get("city"),
      state: formData.get("state"),
      modality: formData.get("modality"),
      contractType: formData.get("contractType"),
      description: richFields.description,
      responsibilities: richFields.responsibilities,
      requiredRequirements: richFields.requiredRequirements,
      desiredRequirements: richFields.desiredRequirements || undefined,
      benefits: richFields.benefits || undefined,
      workSchedule: formData.get("workSchedule") || undefined,
      salaryRange: salaryRange || undefined,
      openings: formData.get("openings")
        ? Number(formData.get("openings"))
        : undefined,
      highlightBenefit: highlightBenefit || undefined,
      closingDate: formData.get("closingDate") || null,
      tallyFormUrl: formData.get("tallyFormUrl") || undefined,
      status: formData.get("status"),
    };

    const url = job ? `/api/jobs/${job.id}` : "/api/jobs";
    const method = job ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(
          data.error?.fieldErrors
            ? Object.values(data.error.fieldErrors).flat().join(", ")
            : data.error || "Erro ao salvar vaga"
        );
        return;
      }

      setSaved(true);
      setTimeout(() => router.push("/vagas/gerenciar"), 800);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelClass}>
            Título da vaga <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="title"
            required
            defaultValue={job?.title}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Área / Departamento</label>
          <input
            type="text"
            name="department"
            defaultValue={job?.department ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Empresa / Unidade</label>
          <input
            type="text"
            name="company"
            defaultValue={job?.company ?? ""}
            placeholder="Ex: WG Baterias SP"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Faixa Salarial</label>
          <input
            type="text"
            value={salaryRange}
            onChange={(e) => setSalaryRange(e.target.value)}
            placeholder="Ex: R$ 2.500 – R$ 3.000"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Quantidade de Vagas</label>
          <input
            type="number"
            name="openings"
            defaultValue={job?.openings ?? ""}
            min={1}
            placeholder="Ex: 2"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Benefício em Destaque</label>
          <input
            type="text"
            value={highlightBenefit}
            onChange={(e) => setHighlightBenefit(e.target.value)}
            placeholder="Ex: Plano de Saúde"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>
            Status <span className="text-red-400">*</span>
          </label>
          <select
            name="status"
            defaultValue={job?.status || "ACTIVE"}
            className={inputClass}
          >
            <option value="ACTIVE" className="bg-wg-card">Ativa</option>
            <option value="PAUSED" className="bg-wg-card">Pausada</option>
            <option value="CLOSED" className="bg-wg-card">Encerrada</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            Cidade <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="city"
            required
            defaultValue={job?.city}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>
            UF <span className="text-red-400">*</span>
          </label>
          <select
            name="state"
            required
            defaultValue={job?.state || "SP"}
            className={inputClass}
          >
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf} className="bg-wg-card">
                {uf}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>
            Modalidade <span className="text-red-400">*</span>
          </label>
          <select
            name="modality"
            defaultValue={job?.modality || "PRESENTIAL"}
            className={inputClass}
          >
            <option value="PRESENTIAL" className="bg-wg-card">Presencial</option>
            <option value="REMOTE" className="bg-wg-card">Remoto</option>
            <option value="HYBRID" className="bg-wg-card">Híbrido</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            Tipo de contratação <span className="text-red-400">*</span>
          </label>
          <select
            name="contractType"
            defaultValue={job?.contractType || "CLT"}
            className={inputClass}
          >
            <option value="CLT" className="bg-wg-card">CLT</option>
            <option value="PJ" className="bg-wg-card">PJ</option>
            <option value="INTERNSHIP" className="bg-wg-card">Estágio</option>
            <option value="APPRENTICE" className="bg-wg-card">Jovem Aprendiz</option>
            <option value="TEMPORARY" className="bg-wg-card">Temporário</option>
            <option value="OTHER" className="bg-wg-card">Outro</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Horário de trabalho</label>
          <input
            type="text"
            name="workSchedule"
            defaultValue={job?.workSchedule ?? ""}
            placeholder="Ex: Seg a Sex, 08h-17h"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Data de encerramento</label>
          <input
            type="date"
            name="closingDate"
            defaultValue={
              job?.closingDate
                ? new Date(job.closingDate).toISOString().split("T")[0]
                : ""
            }
            className={inputClass}
          />
        </div>

        <div className="col-span-2">
          <label className={labelClass}>
            Link do formulário Tally (candidatura)
          </label>
          <input
            type="url"
            name="tallyFormUrl"
            defaultValue={job?.tallyFormUrl ?? ""}
            placeholder="https://tally.so/r/..."
            className={inputClass}
          />
          <p className="text-xs text-wg-gray mt-1">
            Cole aqui o link do formulário Tally desta vaga. Aparecerá como botão
            &quot;Candidatar-se&quot; no portal.
          </p>
        </div>
      </div>

      {([
        { label: "Descrição da vaga", key: "description", required: true },
        { label: "Responsabilidades", key: "responsibilities", required: true },
        { label: "Requisitos Obrigatórios", key: "requiredRequirements", required: true },
        { label: "Requisitos Desejáveis", key: "desiredRequirements", required: false },
        { label: "Benefícios", key: "benefits", required: false },
      ] as const).map((f) => (
        <div key={f.key}>
          <label className={labelClass}>
            {f.label}{" "}
            {f.required && <span className="text-red-400">*</span>}
          </label>
          <RichTextEditor content={richFields[f.key]} onChange={setRich(f.key)} />
        </div>
      ))}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || saved}
        className="w-full bg-wg-green hover:bg-wg-green-bright disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Salvando...
          </>
        ) : saved ? (
          <>
            <Check className="w-4 h-4" />
            Salvo! Redirecionando...
          </>
        ) : job ? (
          "Salvar alterações"
        ) : (
          "Publicar vaga"
        )}
      </button>
    </form>
  );
}
