"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAZIL_STATES } from "@/lib/utils";
import { Loader2, Check } from "lucide-react";
import type { Job, Modality, ContractType, JobStatus } from "@prisma/client";

interface Props {
  job?: Job; // Se fornecido, é modo de edição
}

export default function JobForm({ job }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const body = {
      title: formData.get("title"),
      department: formData.get("department") || undefined,
      city: formData.get("city"),
      state: formData.get("state"),
      modality: formData.get("modality"),
      contractType: formData.get("contractType"),
      description: formData.get("description"),
      responsibilities: formData.get("responsibilities"),
      requiredRequirements: formData.get("requiredRequirements"),
      desiredRequirements: formData.get("desiredRequirements") || undefined,
      benefits: formData.get("benefits") || undefined,
      workSchedule: formData.get("workSchedule") || undefined,
      closingDate: formData.get("closingDate") || null,
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
        setError(data.error?.fieldErrors
          ? Object.values(data.error.fieldErrors).flat().join(", ")
          : data.error || "Erro ao salvar vaga");
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

  const field = (label: string, name: string, required = false) => (
    <div key={name}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título da vaga <span className="text-red-500">*</span>
          </label>
          <input
            type="text" name="title" required defaultValue={job?.title}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Área / Departamento</label>
          <input
            type="text" name="department" defaultValue={job?.department ?? ""}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
          <select name="status" defaultValue={job?.status || "ACTIVE"}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
            <option value="ACTIVE">Ativa</option>
            <option value="PAUSED">Pausada</option>
            <option value="CLOSED">Encerrada</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cidade <span className="text-red-500">*</span></label>
          <input type="text" name="city" required defaultValue={job?.city}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">UF <span className="text-red-500">*</span></label>
          <select name="state" required defaultValue={job?.state || "SP"}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
            {BRAZIL_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modalidade <span className="text-red-500">*</span></label>
          <select name="modality" defaultValue={job?.modality || "PRESENTIAL"}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
            <option value="PRESENTIAL">Presencial</option>
            <option value="REMOTE">Remoto</option>
            <option value="HYBRID">Híbrido</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de contratação <span className="text-red-500">*</span></label>
          <select name="contractType" defaultValue={job?.contractType || "CLT"}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
            <option value="CLT">CLT</option>
            <option value="PJ">PJ</option>
            <option value="INTERNSHIP">Estágio</option>
            <option value="APPRENTICE">Jovem Aprendiz</option>
            <option value="TEMPORARY">Temporário</option>
            <option value="OTHER">Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Horário de trabalho</label>
          <input type="text" name="workSchedule" defaultValue={job?.workSchedule ?? ""}
            placeholder="Ex: Seg a Sex, 08h-17h"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data de encerramento</label>
          <input type="date" name="closingDate"
            defaultValue={job?.closingDate ? new Date(job.closingDate).toISOString().split("T")[0] : ""}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        </div>
      </div>

      {[
        { label: "Descrição da vaga", name: "description", required: true, value: job?.description },
        { label: "Responsabilidades", name: "responsibilities", required: true, value: job?.responsibilities },
        { label: "Requisitos Obrigatórios", name: "requiredRequirements", required: true, value: job?.requiredRequirements },
        { label: "Requisitos Desejáveis", name: "desiredRequirements", required: false, value: job?.desiredRequirements },
        { label: "Benefícios", name: "benefits", required: false, value: job?.benefits },
      ].map((f) => (
        <div key={f.name}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {f.label} {f.required && <span className="text-red-500">*</span>}
          </label>
          <textarea
            name={f.name}
            required={f.required}
            defaultValue={f.value ?? ""}
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y"
          />
        </div>
      ))}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={isLoading || saved}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> :
         saved ? <><Check className="w-4 h-4" /> Salvo! Redirecionando...</> :
         job ? "Salvar alterações" : "Publicar vaga"}
      </button>
    </form>
  );
}
