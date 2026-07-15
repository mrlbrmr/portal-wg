"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAZIL_STATES, isPublicJobStatus } from "@/lib/utils";
import { Loader2, Check, ExternalLink } from "lucide-react";
import { RichTextEditor } from "@/components/internal/RichTextEditor";
import type { Job } from "@prisma/client";

interface Props {
  job?: Job;
}

const inputClass =
  "w-full bg-wg-card-2 border border-wg-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-wg-gray focus:outline-none focus:ring-2 focus:ring-wg-green/40 transition-colors";

const labelClass = "block text-sm font-medium text-wg-gray mb-1";

const REQUIRED_RICH_FIELDS: { key: "description" | "responsibilities" | "requiredRequirements"; label: string }[] = [
  { key: "description", label: "Descrição da vaga" },
  { key: "responsibilities", label: "Responsabilidades" },
  { key: "requiredRequirements", label: "Requisitos Obrigatórios" },
];

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

  const [salaryRange, setSalaryRange] = useState(job?.salaryRange ?? "");
  const [highlightBenefit, setHighlightBenefit] = useState(
    job?.highlightBenefit ?? ""
  );
  const [applyMode, setApplyMode] = useState<string>(job?.applyMode ?? "EXTERNAL");

  function setRich(key: keyof typeof richFields) {
    return (html: string) => setRichFields((prev) => ({ ...prev, [key]: html }));
  }

  function validateRichFields(): string | null {
    for (const { key, label } of REQUIRED_RICH_FIELDS) {
      const text = richFields[key].replace(/<[^>]*>/g, "").trim();
      if (text.length < 10) {
        return `O campo "${label}" é obrigatório (mínimo 10 caracteres de texto).`;
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const richError = validateRichFields();
    if (richError) {
      setError(richError);
      return;
    }

    setIsLoading(true);

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
      hiringDeadline: formData.get("hiringDeadline") || null,
      tallyFormUrl: formData.get("tallyFormUrl") || undefined,
      applyMode: formData.get("applyMode") || "EXTERNAL",
      responsible: formData.get("responsible") || undefined,
      status: formData.get("status"),
    };

    const url = job ? `/api/jobs/${job.id}` : "/api/jobs";
    const method = job ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let message = "Erro ao salvar vaga";
        try {
          const data = await res.json();
          if (data.error?.fieldErrors) {
            message = Object.values(data.error.fieldErrors).flat().join(", ");
          } else if (data.error?.formErrors?.length) {
            message = data.error.formErrors.join(", ");
          } else if (typeof data.error === "string") {
            message = data.error;
          }
        } catch {
          message = `Erro ${res.status}: ${res.statusText || "falha na requisição"}`;
        }
        setError(message);
        return;
      }

      setSaved(true);
      setTimeout(() => router.push("/vagas/gerenciar"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de conexão. Tente novamente.");
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
            <option value="DRAFT" className="bg-wg-card">Rascunho — só no painel</option>
            <option value="ACTIVE" className="bg-wg-card">Ativa — publicada no portal</option>
            <option value="SCREENING" className="bg-wg-card">Triagem — no portal (etapa interna)</option>
            <option value="INTERVIEW" className="bg-wg-card">Entrevistas — no portal (etapa interna)</option>
            <option value="ADMISSION" className="bg-wg-card">Admissão — no portal (etapa interna)</option>
            <option value="PAUSED" className="bg-wg-card">Pausada — fora do portal</option>
            <option value="CLOSED" className="bg-wg-card">Cancelada — fora do portal</option>
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
            Modo de inscrição <span className="text-red-400">*</span>
          </label>
          <select
            name="applyMode"
            value={applyMode}
            onChange={(e) => setApplyMode(e.target.value)}
            className={inputClass}
          >
            <option value="EXTERNAL" className="bg-wg-card">Externo — link do Tally ou e-mail</option>
            <option value="NATIVE" className="bg-wg-card">Formulário no portal — inscrição direta (LGPD)</option>
          </select>
          <p className="text-xs text-wg-gray mt-1">
            {applyMode === "NATIVE"
              ? "O candidato preenche nome, e-mail, celular e anexa o currículo direto na página da vaga. As candidaturas aparecem no painel (Kanban)."
              : "A vaga usa o link do Tally (abaixo) ou, se vazio, um botão de e-mail."}
          </p>
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
            disabled={applyMode === "NATIVE"}
            className={`${inputClass} ${applyMode === "NATIVE" ? "opacity-50" : ""}`}
          />
          <p className="text-xs text-wg-gray mt-1">
            {applyMode === "NATIVE"
              ? "Não usado no modo Formulário no portal."
              : "Cole aqui o link do formulário Tally desta vaga. Aparecerá como botão “Candidatar-se” no portal."}
          </p>
        </div>

        <div className="col-span-2 border-t border-wg-border pt-4">
          <p className="text-xs font-medium text-wg-gray uppercase tracking-wider mb-3">Informações internas (não aparecem no portal)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Responsável pelo processo</label>
              <input
                type="text"
                name="responsible"
                defaultValue={job?.responsible ?? ""}
                placeholder="Ex: Maria Fernanda"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Prazo de contratação</label>
              <input
                type="date"
                name="hiringDeadline"
                defaultValue={
                  job?.hiringDeadline
                    ? new Date(job.hiringDeadline).toISOString().split("T")[0]
                    : ""
                }
                className={inputClass}
              />
              <p className="text-xs text-wg-gray mt-1">Data-alvo para fechar a seleção.</p>
            </div>
          </div>
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
          {f.required && (
            <p className="text-xs text-wg-gray mt-1">Campo obrigatório — preencha com pelo menos uma frase.</p>
          )}
        </div>
      ))}

      {/* Progresso das seções obrigatórias */}
      {(() => {
        const filled = REQUIRED_RICH_FIELDS.filter(
          ({ key }) => richFields[key].replace(/<[^>]*>/g, "").trim().length >= 10
        ).length;
        const total = REQUIRED_RICH_FIELDS.length;
        return (
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-1.5 bg-wg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-wg-green transition-all duration-300 rounded-full"
                style={{ width: `${(filled / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-wg-gray shrink-0">
              {filled}/{total} seções preenchidas
            </span>
          </div>
        );
      })()}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {job && isPublicJobStatus(job.status) && (
          <a
            href={`/vagas/${job.slug ?? job.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 border border-wg-border hover:border-wg-green/50 text-wg-gray hover:text-wg-green px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-4 h-4" />
            Ver prévia
          </a>
        )}
        <button
          type="submit"
          disabled={isLoading || saved}
          className="flex-1 bg-wg-green hover:bg-wg-green-bright disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
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
      </div>
    </form>
  );
}
