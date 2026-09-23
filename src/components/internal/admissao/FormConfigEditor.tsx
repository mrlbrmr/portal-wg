"use client";

// Editor do Formulário de Admissão Digital (Configurações), organizado em abas:
// Conteúdo · Perguntas · Documentos · Regras · Visualização.
// A configuração é um JSON único (admission_form_config#default), salvo pela barra
// inferior. A visualização usa o MESMO componente do link do candidato.

import { useEffect, useState } from "react";
import { Eye, FileText, ListChecks, MessageSquareText, RotateCcw, RotateCw, Workflow } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { SettingsSaveBar, useSettingsDraft } from "@/components/internal/settings/SettingsSaveBar";
import { SettingsTabs, tabId, tabPanelId, useTabsBaseId } from "@/components/internal/settings/SettingsTabs";
import { PreviewPanel } from "@/components/internal/settings/fields";
import { DigitalForm } from "@/app/admissao/[token]/DigitalForm";
import { DEFAULT_FORM_CONFIG, type FormConfig } from "@/lib/admissao/form-config";
import { saveFormConfig } from "@/lib/admissao/form-config-actions";
import { ContentTab } from "./form-editor/ContentTab";
import { QuestionsTab } from "./form-editor/QuestionsTab";
import { DocumentsTab } from "./form-editor/DocumentsTab";
import { RulesTab } from "./form-editor/RulesTab";

type TabKey = "conteudo" | "perguntas" | "documentos" | "regras" | "visualizacao";
const TAB_KEYS: TabKey[] = ["conteudo", "perguntas", "documentos", "regras", "visualizacao"];

function clientCheck(config: FormConfig): string | null {
  if (config.documents.some((d) => !d.label.trim())) return "Há documento sem nome.";
  const keys = config.documents.map((d) => d.key);
  if (new Set(keys).size !== keys.length) return "Há documentos repetidos.";
  for (const d of config.documents) {
    if ((d.extraFields ?? []).some((f) => !f.label.trim() || !f.key.trim())) {
      return `“${d.label}”: preencha rótulo e chave dos campos de texto.`;
    }
  }
  const lists: Array<[string, string[]]> = [
    ["gênero", config.genderOptions],
    ["estado civil", config.maritalOptions],
    ["autodeclaração de cor", config.colorOptions],
  ];
  for (const [name, list] of lists) {
    if (list.length === 0 || list.some((o) => !o.trim())) return `Opções de ${name}: não deixe opções vazias.`;
  }
  return null;
}

export function FormConfigEditor({ initial, documentTypeNames }: { initial: FormConfig; documentTypeNames: string[] }) {
  const { notify } = useToast();
  const draft = useSettingsDraft(initial, async (config) => {
    const problem = clientCheck(config);
    if (problem) return { ok: false, error: problem };
    return saveFormConfig(config);
  });
  const config = draft.value;
  const set = draft.setValue;

  const baseId = useTabsBaseId();
  const [tab, setTab] = useState<TabKey>("conteudo");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  // Deep link: /configuracoes/formulario-admissao#documentos
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as TabKey;
    if (TAB_KEYS.includes(fromHash)) setTab(fromHash);
  }, []);

  function changeTab(key: TabKey) {
    setTab(key);
    window.history.replaceState(null, "", `#${key}`);
  }

  const tabs = [
    { key: "conteudo" as const, label: "Conteúdo", icon: MessageSquareText },
    { key: "perguntas" as const, label: "Perguntas", icon: ListChecks },
    { key: "documentos" as const, label: "Documentos", icon: FileText, badge: config.documents.length },
    { key: "regras" as const, label: "Regras", icon: Workflow },
    { key: "visualizacao" as const, label: "Visualização", icon: Eye },
  ];

  return (
    <>
      <SettingsTabs label="Seções do formulário" baseId={baseId} tabs={tabs} value={tab} onChange={changeTab} />

      <div role="tabpanel" id={tabPanelId(baseId, tab)} aria-labelledby={tabId(baseId, tab)} tabIndex={-1}>
        {tab === "conteudo" && <ContentTab config={config} set={set} />}
        {tab === "perguntas" && <QuestionsTab config={config} set={set} />}
        {tab === "documentos" && (
          <DocumentsTab
            config={config}
            set={set}
            documentTypeNames={documentTypeNames}
            expanded={expandedDoc}
            setExpanded={setExpandedDoc}
          />
        )}
        {tab === "regras" && (
          <RulesTab
            config={config}
            set={set}
            onEditDocument={(key) => {
              setExpandedDoc(key);
              changeTab("documentos");
            }}
          />
        )}
        {tab === "visualizacao" && (
          <PreviewPanel
            description="Assim o candidato vê o formulário, já com as alterações não salvas. Nada é enviado: arquivos ficam só nesta tela e é possível avançar sem preencher."
            toolbar={
              <Button variant="secondary" size="sm" icon={RotateCw} onClick={() => setPreviewKey((k) => k + 1)}>
                Recomeçar
              </Button>
            }
          >
            <div className="rounded-card bg-gray-50">
              <DigitalForm key={previewKey} token="preview" candidateName="Maria Silva" config={config} preview />
            </div>
          </PreviewPanel>
        )}
      </div>

      <SettingsSaveBar
        isDirty={draft.isDirty}
        isSaving={draft.isSaving}
        savedAt={draft.savedAt}
        onSave={draft.save}
        onDiscard={draft.discard}
        extra={
          <Button variant="tertiary" size="sm" icon={RotateCcw} onClick={() => setConfirmReset(true)} disabled={draft.isSaving}>
            Restaurar padrão
          </Button>
        }
      />

      <ConfirmModal
        isOpen={confirmReset}
        variant="danger"
        title="Restaurar configuração padrão?"
        message="As personalizações atuais deste formulário serão substituídas pelas configurações padrão. Você poderá revisar antes de salvar."
        confirmLabel="Restaurar padrão"
        onConfirm={() => {
          set(structuredClone(DEFAULT_FORM_CONFIG));
          setConfirmReset(false);
          setExpandedDoc(null);
          notify("info", "Padrão restaurado. Revise e clique em Salvar alterações para aplicar.");
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}
