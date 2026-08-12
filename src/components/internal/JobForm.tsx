"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAZIL_STATES, isPublicJobStatus } from "@/lib/utils";
import { Check, ExternalLink, Eye, Loader2, Pencil } from "lucide-react";
import type { Job } from "@/types/domain";

const MARKDOWN_BOILERPLATE = [
  "### Responsabilidades",
  "",
  "",
  "### Requisitos Obrigatórios",
  "",
  "",
  "### Requisitos Desejáveis",
  "",
  "",
  "### Benefícios",
  "",
].join("\n");

function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function markdownToHtml(md: string): string {
  if (!md.trim()) {
    return '<p style="color:#9ca3af;font-style:italic">Nenhum conteúdo ainda.</p>';
  }
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("### ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

function maskBRL(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 12);
  if (!d) return "";
  const cents = parseInt(d, 10);
  const reaisStr = Math.floor(cents / 100).toLocaleString("pt-BR");
  const centavos = String(cents % 100).padStart(2, "0");
  return `R$ ${reaisStr},${centavos}`;
}

function initialSalaryDigits(job?: Job): string {
  if (!job?.salary) return "";
  return String(Math.round(job.salary * 100));
}

function buildInitialContent(job?: Job): string {
  if (!job) return MARKDOWN_BOILERPLATE;
  const hasLegacy =
    job.responsibilities ||
    job.requiredRequirements ||
    job.desiredRequirements ||
    job.benefits;
  if (!hasLegacy) return job.description ?? MARKDOWN_BOILERPLATE;
  const parts: string[] = [];
  if (job.description) parts.push(job.description);
  if (job.responsibilities) parts.push(`## Responsabilidades\n${job.responsibilities}`);
  if (job.requiredRequirements) parts.push(`## Requisitos Obrigatórios\n${job.requiredRequirements}`);
  if (job.desiredRequirements) parts.push(`## Requisitos Desejáveis\n${job.desiredRequirements}`);
  if (job.benefits) parts.push(`## Benefícios\n${job.benefits}`);
  return parts.join("\n\n");
}

interface Props {
  job?: Job;
}

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";

const labelClass = "block text-sm font-medium text-gray-700 mb-1";

const sectionTitle = "text-xs font-semibold text-gray-400 uppercase tracking-wider";

export default function JobForm({ job }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [mdContent, setMdContent] = useState(() => buildInitialContent(job));
  const [isTalentPool, setIsTalentPool] = useState(job?.isTalentPool ?? false);
  const [salaryDigits, setSalaryDigits] = useState(() => initialSalaryDigits(job));
  const [salaryHidden, setSalaryHidden] = useState(() => job?.salaryRange === "A combinar");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (mdContent.trim().length < 10) {
      setError('O campo "Conteúdo da vaga" é obrigatório (mínimo 10 caracteres).');
      return;
    }

    setIsLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const salaryValue = salaryDigits ? parseInt(salaryDigits, 10) / 100 : undefined;

    const body = {
      title: formData.get("title"),
      department: formData.get("department") || undefined,
      company: formData.get("company") || undefined,
      isTalentPool,
      city: isTalentPool ? null : formData.get("city"),
      state: isTalentPool ? null : formData.get("state"),
      modality: formData.get("modality"),
      contractType: formData.get("contractType"),
      description: markdownToHtml(mdContent),
      responsibilities: null,
      requiredRequirements: null,
      desiredRequirements: null,
      benefits: null,
      workSchedule: formData.get("workSchedule") || undefined,
      salary: salaryHidden ? null : (salaryValue ?? undefined),
      salaryRange: salaryHidden ? "A combinar" : undefined,
      openings: formData.get("openings")
        ? Number(formData.get("openings"))
        : undefined,
      closingDate: formData.get("closingDate") || null,
      hiringDeadline: formData.get("hiringDeadline") || null,
      responsible: formData.get("responsible") || undefined,
      status: formData.get("status"),
      priority: formData.get("priority") || "MEDIUM",
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
      setError(
        err instanceof Error ? err.message : "Erro de conexão. Tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Dados Principais ────────────────────────────────── */}
      <div>
        <p className={sectionTitle}>Dados Principais</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>
              Título da vaga <span className="text-red-500">*</span>
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

          {/* Salário Fixo com toggle A combinar */}
          <div>
            <label className={labelClass}>Salário Fixo</label>
            <input
              type="text"
              inputMode="numeric"
              value={salaryHidden ? "" : maskBRL(salaryDigits)}
              onChange={(e) => setSalaryDigits(e.target.value.replace(/\D/g, ""))}
              placeholder={salaryHidden ? "A combinar" : "R$ 0,00"}
              disabled={salaryHidden}
              className={`${inputClass} ${salaryHidden ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""}`}
            />
            <label className="mt-1.5 flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={salaryHidden}
                onChange={(e) => setSalaryHidden(e.target.checked)}
                className="w-3.5 h-3.5 accent-wg-green"
              />
              <span className="text-xs text-gray-500">Ocultar salário / A combinar</span>
            </label>
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
        </div>
      </div>

      {/* ── Localização e Formato ────────────────────────────── */}
      <div className="border-t border-gray-100 pt-5">
        <p className={sectionTitle}>Localização e Formato</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isTalentPool}
                onChange={(e) => setIsTalentPool(e.target.checked)}
                className="w-4 h-4 accent-wg-green"
              />
              <span className="text-sm font-medium text-gray-700">Banco de Talentos</span>
              <span className="text-xs text-gray-500">
                — coleta de currículos, sem cidade específica (múltiplas filiais)
              </span>
            </label>
          </div>

          {!isTalentPool && (
            <>
              <div>
                <label className={labelClass}>
                  Cidade <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  required
                  defaultValue={job?.city ?? ""}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  UF <span className="text-red-500">*</span>
                </label>
                <select
                  name="state"
                  required
                  defaultValue={job?.state ?? "SP"}
                  className={inputClass}
                >
                  {BRAZIL_STATES.map((uf) => (
                    <option key={uf} value={uf} className="bg-white">
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className={labelClass}>
              Modalidade <span className="text-red-500">*</span>
            </label>
            <select
              name="modality"
              defaultValue={job?.modality || "PRESENTIAL"}
              className={inputClass}
            >
              <option value="PRESENTIAL" className="bg-white">Presencial</option>
              <option value="REMOTE" className="bg-white">Remoto</option>
              <option value="HYBRID" className="bg-white">Híbrido</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Tipo de contratação <span className="text-red-500">*</span>
            </label>
            <select
              name="contractType"
              defaultValue={job?.contractType || "CLT"}
              className={inputClass}
            >
              <option value="CLT" className="bg-white">CLT</option>
              <option value="PJ" className="bg-white">PJ</option>
              <option value="INTERNSHIP" className="bg-white">Estágio</option>
              <option value="APPRENTICE" className="bg-white">Jovem Aprendiz</option>
              <option value="TEMPORARY" className="bg-white">Temporário</option>
              <option value="OTHER" className="bg-white">Outro</option>
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
        </div>

        <div className="mt-4 rounded-lg border border-wg-green/30 bg-wg-green/5 px-3 py-2.5">
          <p className="text-xs text-gray-600">
            <span className="font-medium text-wg-green-dark">Inscrição pelo portal.</span>{" "}
            O candidato preenche nome, e-mail, celular e anexa o currículo direto na
            página da vaga. As candidaturas aparecem no painel, no Kanban de candidatos.
          </p>
        </div>
      </div>

      {/* ── Informações Internas ─────────────────────────────── */}
      <div className="border-t border-gray-200 pt-5">
        <p className={`${sectionTitle} mb-3`}>
          Informações internas{" "}
          <span className="font-normal normal-case tracking-normal text-gray-400">
            (não aparecem no portal)
          </span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Status <span className="text-red-500">*</span>
            </label>
            <select
              name="status"
              defaultValue={job?.status || "ACTIVE"}
              className={inputClass}
            >
              <option value="DRAFT" className="bg-white">Rascunho — só no painel</option>
              <option value="ACTIVE" className="bg-white">Ativa — publicada no portal</option>
              <option value="SCREENING" className="bg-white">Triagem — no portal (etapa interna)</option>
              <option value="INTERVIEW" className="bg-white">Entrevistas — no portal (etapa interna)</option>
              <option value="ADMISSION" className="bg-white">Admissão — no portal (etapa interna)</option>
              <option value="PAUSED" className="bg-white">Pausada — fora do portal</option>
              <option value="CLOSED" className="bg-white">Cancelada — fora do portal</option>
              <option value="FILLED" className="bg-white">Finalizada — fora do portal</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Prioridade <span className="text-red-500">*</span>
            </label>
            <select
              name="priority"
              defaultValue={job?.priority || "MEDIUM"}
              className={inputClass}
            >
              <option value="LOW" className="bg-white">Baixa</option>
              <option value="MEDIUM" className="bg-white">Média</option>
              <option value="HIGH" className="bg-white">Alta</option>
              <option value="URGENT" className="bg-white">Urgente</option>
            </select>
          </div>

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
            <p className="text-xs text-gray-500 mt-1">Data-alvo para fechar a seleção.</p>
          </div>
        </div>
      </div>

      {/* ── Editor de Markdown ───────────────────────────────── */}
      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass}>
            Conteúdo da vaga <span className="text-red-500">*</span>
          </label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setEditorTab("write")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                editorTab === "write"
                  ? "bg-wg-green/10 text-wg-green-dark"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Pencil className="w-3 h-3" />
              Escrever
            </button>
            <div className="w-px bg-gray-200 self-stretch" />
            <button
              type="button"
              onClick={() => setEditorTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                editorTab === "preview"
                  ? "bg-wg-green/10 text-wg-green-dark"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Eye className="w-3 h-3" />
              Visualizar
            </button>
          </div>
        </div>

        {editorTab === "write" ? (
          <textarea
            value={mdContent}
            onChange={(e) => setMdContent(e.target.value)}
            rows={14}
            placeholder="Use Markdown para estruturar a vaga..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors font-mono resize-y"
          />
        ) : (
          <div
            className="min-h-[200px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-gray-800 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:mb-1 [&_strong]:font-semibold [&_em]:italic [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(mdContent) }}
          />
        )}
        <p className="text-xs text-gray-500 mt-1">
          Use Markdown:{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">### Título</code>,{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">- item</code>,{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">**negrito**</code>
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {job && isPublicJobStatus(job.status) && (
          <a
            href={`/vagas/${job.slug ?? job.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 border border-gray-300 hover:border-wg-green text-gray-600 hover:text-wg-green-dark px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
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
