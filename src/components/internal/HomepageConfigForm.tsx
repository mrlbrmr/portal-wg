"use client";

import {
  Briefcase,
  Building2,
  Clock,
  FileSignature,
  Filter,
  Hash,
  Lock,
  MapPin,
  MonitorSmartphone,
  Network,
  Star,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Toggle } from "@/components/ui/Toggle";
import JobCard from "@/components/public/JobCard";
import { PreviewPanel, SettingsField, describedBy, settingsInputClass } from "@/components/internal/settings/fields";
import { SettingsSaveBar, useSettingsDraft, type SaveResult } from "@/components/internal/settings/SettingsSaveBar";
import type { HomepageConfigData } from "@/lib/homepage-config";
import type { Job } from "@/types/domain";

type Mode = "appearance" | "cards";

type CardFieldKey =
  | "showDepartment"
  | "showLocation"
  | "showModality"
  | "showContractType"
  | "showCompany"
  | "showWorkSchedule"
  | "showSalary"
  | "showHighlightBenefit"
  | "showOpenings";

const CARD_FIELDS: { key: CardFieldKey; label: string; icon: LucideIcon }[] = [
  { key: "showDepartment", label: "Área / departamento", icon: Network },
  { key: "showLocation", label: "Cidade / UF", icon: MapPin },
  { key: "showModality", label: "Modalidade", icon: MonitorSmartphone },
  { key: "showContractType", label: "Tipo de contrato", icon: FileSignature },
  { key: "showCompany", label: "Empresa / unidade", icon: Building2 },
  { key: "showWorkSchedule", label: "Jornada / horário", icon: Clock },
  { key: "showSalary", label: "Salário", icon: Wallet },
  { key: "showHighlightBenefit", label: "Benefício destaque", icon: Star },
  { key: "showOpenings", label: "Vagas em aberto (posições restantes)", icon: Users },
];

const APPEARANCE_KEYS = ["jobsSectionTitle", "jobsSectionSubtitle", "showFilters", "showJobCounter"] as const;

// Vaga de EXEMPLO — existe só no preview, nunca é gravada no banco.
const SAMPLE_JOB: Job = {
  id: "preview",
  code: null,
  title: "Analista Administrativo",
  department: "Administrativo",
  company: "WG Baterias — Matriz",
  city: "São José dos Pinhais",
  state: "PR",
  isTalentPool: false,
  modality: "PRESENTIAL",
  contractType: "CLT",
  description: "",
  responsibilities: "",
  requiredRequirements: "",
  desiredRequirements: null,
  benefits: null,
  workSchedule: "Seg. a sex., 8h às 17h48",
  salaryRange: "R$ 3.200,00",
  salary: 3200,
  openings: 2,
  openPositions: 2,
  salaryPublic: true,
  approvedScope: null,
  highlightBenefit: "Vale-alimentação",
  responsible: null,
  hiringManager: null,
  requestId: null,
  openingReason: null,
  slug: null,
  closingDate: null,
  hiringDeadline: null,
  status: "ACTIVE",
  visibility: "BOTH",
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function persist(mode: Mode, config: HomepageConfigData): Promise<SaveResult> {
  if (mode === "appearance" && !config.jobsSectionTitle.trim()) {
    return { ok: false, error: "Informe o título da seção de vagas." };
  }
  const keys: readonly (keyof HomepageConfigData)[] =
    mode === "appearance" ? APPEARANCE_KEYS : CARD_FIELDS.map((f) => f.key);
  const body = Object.fromEntries(keys.map((k) => [k, config[k]]));
  const res = await fetch("/api/homepage-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok ? { ok: true } : { ok: false };
}

export default function HomepageConfigForm({ initialConfig, mode }: { initialConfig: HomepageConfigData; mode: Mode }) {
  const draft = useSettingsDraft(initialConfig, (v) => persist(mode, v));
  const config = draft.value;

  function patch(p: Partial<HomepageConfigData>) {
    draft.setValue((prev) => ({ ...prev, ...p }));
  }

  const titleError = mode === "appearance" && !config.jobsSectionTitle.trim() ? "Informe o título da seção." : null;

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ── Configurações ── */}
        <div className="space-y-5">
          {mode === "cards" ? (
            <Panel
              title="Informações do card"
              description="Escolha o que o candidato vê em cada vaga da lista. Informações não preenchidas na vaga não aparecem."
            >
              <div className="divide-y divide-wg-border-lighter">
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="h-4 w-4 shrink-0 text-wg-ink-muted" aria-hidden />
                    <span className="text-body text-wg-ink">Cargo</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-label text-wg-ink-muted">
                    <Lock className="h-3.5 w-3.5" aria-hidden /> Sempre exibido
                  </span>
                </div>
                {CARD_FIELDS.map(({ key, label, icon }) => (
                  <Toggle
                    key={key}
                    label={label}
                    icon={icon}
                    checked={config[key]}
                    stateLabels={["Exibido", "Oculto"]}
                    onChange={() => patch({ [key]: !config[key] } as Partial<HomepageConfigData>)}
                  />
                ))}
              </div>
            </Panel>
          ) : (
            <>
              <Panel title="Seção de vagas" description="Texto exibido acima da lista de vagas na página inicial.">
                <div className="space-y-4">
                  <SettingsField id="hp-title" label="Título" required error={titleError}>
                    <input
                      id="hp-title"
                      type="text"
                      maxLength={100}
                      value={config.jobsSectionTitle}
                      onChange={(e) => patch({ jobsSectionTitle: e.target.value })}
                      aria-invalid={!!titleError}
                      aria-describedby={describedBy("hp-title", { error: titleError })}
                      className={settingsInputClass}
                      placeholder="Ex.: Vagas abertas"
                    />
                  </SettingsField>
                  <SettingsField id="hp-subtitle" label="Subtítulo" hint="Até 300 caracteres.">
                    <input
                      id="hp-subtitle"
                      type="text"
                      maxLength={300}
                      value={config.jobsSectionSubtitle}
                      onChange={(e) => patch({ jobsSectionSubtitle: e.target.value })}
                      aria-describedby="hp-subtitle-hint"
                      className={settingsInputClass}
                      placeholder="Ex.: Encontre a vaga ideal para você"
                    />
                  </SettingsField>
                </div>
              </Panel>
              <Panel title="Elementos da página">
                <div className="divide-y divide-wg-border-lighter">
                  <Toggle
                    label="Filtros de busca"
                    description="Busca por cargo, cidade, modalidade e área acima da lista."
                    icon={Filter}
                    checked={config.showFilters}
                    stateLabels={["Exibido", "Oculto"]}
                    onChange={() => patch({ showFilters: !config.showFilters })}
                  />
                  <Toggle
                    label="Contador de vagas abertas"
                    description="Destaque no topo da página com o total de vagas."
                    icon={Hash}
                    checked={config.showJobCounter}
                    stateLabels={["Exibido", "Oculto"]}
                    onChange={() => patch({ showJobCounter: !config.showJobCounter })}
                  />
                </div>
              </Panel>
            </>
          )}
        </div>

        {/* ── Pré-visualização ── */}
        <PreviewPanel
          className="lg:sticky lg:top-6"
          description={
            mode === "cards"
              ? "Assim os cards de vaga aparecem para os candidatos. A vaga é apenas um exemplo."
              : "Assim a seção de vagas aparece na página inicial. Os números são apenas um exemplo."
          }
        >
          <div className="overflow-hidden rounded-card bg-wg-dark" aria-live="polite">
            {mode === "appearance" && config.showJobCounter && (
              <div className="flex justify-center bg-wg-green px-4 py-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/10 px-4 py-2 text-[13px] font-semibold text-wg-dark">
                  <Briefcase className="h-3.5 w-3.5" aria-hidden /> 12 vagas abertas
                </span>
              </div>
            )}
            <div className="space-y-4 p-4 sm:p-5">
              {mode === "appearance" && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[1px] text-wg-green">Oportunidades</p>
                  <p className="font-sora text-2xl font-extrabold leading-tight text-white">
                    {config.jobsSectionTitle || "Título da seção"}
                  </p>
                  {config.jobsSectionSubtitle && (
                    <p className="mt-1.5 text-[13px] text-wg-gray">{config.jobsSectionSubtitle}</p>
                  )}
                </div>
              )}
              {mode === "appearance" && config.showFilters && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Filtros (exemplo)">
                  {["Buscar cargo…", "Cidade…", "Modalidade", "Área…"].map((f) => (
                    <div key={f} className="rounded-xl border border-wg-border bg-wg-card px-3 py-2 text-[12px] text-wg-gray">
                      {f}
                    </div>
                  ))}
                </div>
              )}
              <div className="pointer-events-none select-none">
                <JobCard job={SAMPLE_JOB} config={config} preview />
              </div>
            </div>
          </div>
        </PreviewPanel>
      </div>

      <SettingsSaveBar
        isDirty={draft.isDirty}
        isSaving={draft.isSaving}
        savedAt={draft.savedAt}
        onSave={draft.save}
        onDiscard={draft.discard}
      />
    </>
  );
}
