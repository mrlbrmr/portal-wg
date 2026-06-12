"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BRAZIL_STATES } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Loader2, Upload } from "lucide-react";

interface Job {
  id: string;
  title: string;
  city: string;
  state: string;
}

interface Props {
  preselectedJobId?: string;
  jobs: Job[];
}

interface FormErrors {
  [key: string]: string;
}

export default function ApplicationForm({ preselectedJobId, jobs }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [fileName, setFileName] = useState<string | null>(null);

  function validate(formData: FormData): FormErrors {
    const errs: FormErrors = {};

    const fullName = formData.get("fullName") as string;
    if (!fullName || fullName.trim().length < 3) errs.fullName = "Nome completo obrigatório";

    const email = formData.get("email") as string;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "E-mail inválido";

    const phone = formData.get("phone") as string;
    if (!phone || phone.replace(/\D/g, "").length < 10) errs.phone = "Telefone inválido";

    const city = formData.get("city") as string;
    if (!city || city.trim().length < 2) errs.city = "Cidade obrigatória";

    const state = formData.get("state") as string;
    if (!state) errs.state = "UF obrigatória";

    const jobId = formData.get("jobId") as string;
    if (!jobId) errs.jobId = "Selecione uma vaga";

    const resume = formData.get("resume") as File;
    if (!resume || resume.size === 0) {
      errs.resume = "Currículo obrigatório";
    } else if (resume.size > 5 * 1024 * 1024) {
      errs.resume = "Arquivo muito grande. Máximo 5MB";
    }

    const privacy = formData.get("privacyAcceptance");
    if (!privacy) errs.privacyAcceptance = "Aceite obrigatório para enviar a candidatura";

    return errs;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setErrors({});

    const form = e.currentTarget;
    const formData = new FormData(form);

    const validationErrors = validate(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao enviar candidatura. Tente novamente.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Candidatura enviada!</h2>
        <p className="text-gray-600 mb-6">
          Recebemos sua candidatura. Nossa equipe de Gente &amp; Gestão analisará seu
          perfil e entrará em contato caso haja compatibilidade.
        </p>
        <p className="text-sm text-gray-400 mb-8">
          Você receberá um e-mail de confirmação em breve.
        </p>
        <button
          onClick={() => router.push("/")}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Ver outras vagas
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Nome completo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nome completo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="fullName"
          autoComplete="name"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 ${
            errors.fullName ? "border-red-400" : "border-gray-200"
          }`}
        />
        {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
      </div>

      {/* E-mail */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          E-mail <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          name="email"
          autoComplete="email"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 ${
            errors.email ? "border-red-400" : "border-gray-200"
          }`}
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>

      {/* Telefone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Telefone / WhatsApp <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          name="phone"
          autoComplete="tel"
          placeholder="(11) 99999-9999"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 ${
            errors.phone ? "border-red-400" : "border-gray-200"
          }`}
        />
        {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
      </div>

      {/* Cidade e UF */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cidade <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="city"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 ${
              errors.city ? "border-red-400" : "border-gray-200"
            }`}
          />
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            UF <span className="text-red-500">*</span>
          </label>
          <select
            name="state"
            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 ${
              errors.state ? "border-red-400" : "border-gray-200"
            }`}
          >
            <option value="">—</option>
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
          {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
        </div>
      </div>

      {/* Vaga */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Vaga de interesse <span className="text-red-500">*</span>
        </label>
        <select
          name="jobId"
          defaultValue={preselectedJobId || ""}
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 ${
            errors.jobId ? "border-red-400" : "border-gray-200"
          }`}
        >
          <option value="">Selecione uma vaga...</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} — {job.city}/{job.state}
            </option>
          ))}
        </select>
        {errors.jobId && <p className="text-red-500 text-xs mt-1">{errors.jobId}</p>}
      </div>

      {/* Upload do currículo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Currículo <span className="text-red-500">*</span>
          <span className="text-gray-400 font-normal ml-1">(PDF, DOC ou DOCX — máx. 5MB)</span>
        </label>
        <label
          className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-4 cursor-pointer transition-colors ${
            errors.resume
              ? "border-red-400 bg-red-50"
              : "border-gray-200 hover:border-orange-300 hover:bg-orange-50"
          }`}
        >
          <Upload className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <span className="text-sm text-gray-600">
            {fileName ? fileName : "Clique para selecionar o arquivo"}
          </span>
          <input
            type="file"
            name="resume"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setFileName(file ? file.name : null);
            }}
          />
        </label>
        {errors.resume && <p className="text-red-500 text-xs mt-1">{errors.resume}</p>}
      </div>

      {/* Observações */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observações <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          placeholder="Informações adicionais relevantes para a candidatura..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
        />
      </div>

      <hr className="border-gray-100" />

      {/* Aceite de privacidade — obrigatório */}
      <div className={`p-4 rounded-lg border ${errors.privacyAcceptance ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="privacyAcceptance"
            value="true"
            className="mt-0.5 w-4 h-4 accent-orange-500"
          />
          <span className="text-sm text-gray-700">
            <strong>Li e aceito o</strong>{" "}
            <Link
              href="/privacidade"
              target="_blank"
              className="text-orange-600 underline"
            >
              Aviso de Privacidade
            </Link>{" "}
            e consinto com o tratamento dos meus dados pessoais para fins de
            recrutamento e seleção.{" "}
            <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.privacyAcceptance && (
          <p className="text-red-500 text-xs mt-2 ml-7">{errors.privacyAcceptance}</p>
        )}
      </div>

      {/* Banco de talentos — opcional e separado */}
      <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="talentPoolAcceptance"
            value="true"
            className="mt-0.5 w-4 h-4 accent-orange-500"
          />
          <span className="text-sm text-gray-700">
            Aceito que meus dados e currículo sejam mantidos no{" "}
            <strong>banco de talentos</strong> do Grupo WG por até 2 anos, para
            avaliação em vagas futuras.{" "}
            <span className="text-gray-400">(opcional)</span>
          </span>
        </label>
      </div>

      {/* Erro global */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enviando candidatura...
          </>
        ) : (
          "Enviar Candidatura"
        )}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Seus dados são protegidos conforme a LGPD e nunca serão compartilhados
        sem sua autorização.
      </p>
    </form>
  );
}
