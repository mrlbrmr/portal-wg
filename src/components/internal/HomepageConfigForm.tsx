"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import type { HomepageConfigData } from "@/lib/homepage-config";

interface Props {
  initialConfig: HomepageConfigData;
}

const CARD_FIELDS: { key: keyof HomepageConfigData; label: string }[] = [
  { key: "showDepartment",      label: "Área / departamento" },
  { key: "showLocation",        label: "Cidade / UF" },
  { key: "showModality",        label: "Modalidade" },
  { key: "showContractType",    label: "Tipo de contrato" },
  { key: "showCompany",         label: "Empresa / unidade" },
  { key: "showWorkSchedule",    label: "Jornada / horário" },
  { key: "showSalary",          label: "Salário exibido" },
  { key: "showHighlightBenefit",label: "Benefício destaque" },
  { key: "showOpenings",        label: "Quantidade de vagas" },
];

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";

export default function HomepageConfigForm({ initialConfig }: Props) {
  const [config, setConfig] = useState<HomepageConfigData>(initialConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: keyof HomepageConfigData) {
    setConfig((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
    setSaved(false);
  }

  function setText(key: "jobsSectionTitle" | "jobsSectionSubtitle", value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/homepage-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setError("Erro ao salvar configurações. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="space-y-4">
        {/* Campos dos cards de vaga */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-0.5">
            Campos exibidos nos cards de vaga
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            O cargo é sempre exibido. Campos marcados mas sem dados na vaga não aparecem ao candidato.
          </p>
          <div className="divide-y divide-gray-50">
            {CARD_FIELDS.map(({ key, label }) => (
              <Toggle
                key={key}
                label={label}
                checked={config[key] as boolean}
                onChange={() => toggle(key)}
              />
            ))}
          </div>
        </div>

        {/* Opções gerais */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Opções gerais</h2>

          <div className="divide-y divide-gray-50 mb-6">
            <Toggle
              label="Mostrar filtros na homepage"
              checked={config.showFilters}
              onChange={() => toggle("showFilters")}
            />
            <Toggle
              label="Mostrar contador de vagas abertas"
              checked={config.showJobCounter}
              onChange={() => toggle("showJobCounter")}
            />
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Título da seção de vagas
              </label>
              <input
                type="text"
                value={config.jobsSectionTitle}
                onChange={(e) => setText("jobsSectionTitle", e.target.value)}
                className={inputClass}
                placeholder="Ex: Vagas abertas"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Subtítulo da seção de vagas
              </label>
              <input
                type="text"
                value={config.jobsSectionSubtitle}
                onChange={(e) => setText("jobsSectionSubtitle", e.target.value)}
                className={inputClass}
                placeholder="Ex: Encontre a vaga ideal para você"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
      </div>

      {/* Barra de ação flutuante — sticky bottom */}
      <div className="sticky bottom-4 z-10 mt-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-5 py-3.5 flex items-center justify-between gap-4">
          <span className="text-sm text-gray-500">
            {saved ? (
              <span className="text-[#4F6930] font-medium">✓ Configurações salvas</span>
            ) : error ? (
              <span className="text-red-600">Erro ao salvar</span>
            ) : (
              "Lembre de salvar as alterações"
            )}
          </span>
          <button
            onClick={handleSave}
            disabled={isLoading || saved}
            className="flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright disabled:opacity-60 text-black font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Salvo!
              </>
            ) : (
              "Salvar configurações"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
