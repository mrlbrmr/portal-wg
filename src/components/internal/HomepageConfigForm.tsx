"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { HomepageConfigData } from "@/lib/homepage-config";

interface Props {
  initialConfig: HomepageConfigData;
}

const CARD_FIELDS: { key: keyof HomepageConfigData; label: string }[] = [
  { key: "showDepartment", label: "Área / departamento" },
  { key: "showLocation", label: "Cidade / UF" },
  { key: "showModality", label: "Modalidade" },
  { key: "showContractType", label: "Tipo de contrato" },
  { key: "showCompany", label: "Empresa / unidade" },
  { key: "showWorkSchedule", label: "Jornada / horário" },
  { key: "showSalary", label: "Salário exibido" },
  { key: "showHighlightBenefit", label: "Benefício destaque" },
  { key: "showOpenings", label: "Quantidade de vagas" },
];

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";

export default function HomepageConfigForm({ initialConfig }: Props) {
  const [config, setConfig] = useState<HomepageConfigData>(initialConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: keyof HomepageConfigData) {
    setConfig((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
    setSaved(false);
  }

  function setText(
    key: "jobsSectionTitle" | "jobsSectionSubtitle",
    value: string
  ) {
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
    <div className="space-y-5 max-w-2xl">
      {/* Campos dos cards */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <h2 className="text-gray-900 font-semibold mb-1">
          Campos exibidos nos cards de vaga
        </h2>
        <p className="text-gray-500 text-xs mb-5">
          O cargo da vaga é sempre exibido. Campos marcados mas sem informação
          preenchida na vaga não aparecem para o candidato.
        </p>
        <div className="space-y-3">
          {CARD_FIELDS.map(({ key, label }) => (
            <CheckRow
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
        <h2 className="text-gray-900 font-semibold mb-4">Opções gerais</h2>
        <div className="space-y-3 mb-6">
          <CheckRow
            label="Mostrar filtros na homepage"
            checked={config.showFilters}
            onChange={() => toggle("showFilters")}
          />
          <CheckRow
            label="Mostrar contador de vagas abertas"
            checked={config.showJobCounter}
            onChange={() => toggle("showJobCounter")}
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Título da seção de vagas
            </label>
            <input
              type="text"
              value={config.jobsSectionTitle}
              onChange={(e) => setText("jobsSectionTitle", e.target.value)}
              className={inputClass}
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
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={isLoading || saved}
        className="flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright disabled:opacity-60
          text-black font-semibold px-6 py-2.5 rounded-lg transition-colors"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Salvando...
          </>
        ) : saved ? (
          <>
            <Check className="w-4 h-4" />
            Configurações salvas!
          </>
        ) : (
          "Salvar configurações"
        )}
      </button>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <div
        className={`w-5 h-5 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
          checked
            ? "bg-wg-green border-wg-green"
            : "bg-white border-gray-300 group-hover:border-wg-green/50"
        }`}
      >
        {checked && <Check className="w-3 h-3 text-black" />}
      </div>
      <span className="text-sm text-gray-800">{label}</span>
    </label>
  );
}
