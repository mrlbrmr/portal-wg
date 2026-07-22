"use client";

import { useState, useTransition } from "react";
import {
  Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, Loader2, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  DEFAULT_FORM_CONFIG,
  CONDITION_TYPES,
  CONDITION_LABELS,
  type FormConfig,
  type DocumentConfig,
  type DocCondition,
  type ConditionType,
  type ExtraFieldConfig,
} from "@/lib/admissao/form-config";
import { saveFormConfig } from "@/lib/admissao/form-config-actions";

// ─── Estilos compartilhados ────────────────────────────────────────────────────
const input =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wg-green focus:border-transparent";
const label = "block text-xs font-semibold text-gray-600 mb-1";
const card = "bg-white border border-gray-200 rounded-2xl shadow-sm p-5";
const section = "text-base font-semibold text-gray-900 mb-4";

function conditionType(c: DocCondition): ConditionType {
  return c.type;
}
function conditionValues(c: DocCondition): string[] {
  return c.type === "gender" || c.type === "marital" ? c.values : [];
}
function buildCondition(type: ConditionType, values: string[]): DocCondition {
  switch (type) {
    case "gender":  return { type: "gender", values };
    case "marital": return { type: "marital", values };
    case "hasChildren":      return { type: "hasChildren" };
    case "hasItauAccount":   return { type: "hasItauAccount" };
    case "isDriverOperator": return { type: "isDriverOperator" };
    default:                 return { type: "always" };
  }
}

// ─── Editor de lista de strings (opções) ───────────────────────────────────────
function StringListEditor({
  values, onChange, placeholder,
}: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            className={input}
            value={v}
            placeholder={placeholder}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Remover"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        className="inline-flex items-center gap-1 text-xs font-medium text-wg-green-dark hover:underline"
      >
        <Plus className="w-3.5 h-3.5" /> Adicionar opção
      </button>
    </div>
  );
}

// ─── Editor de um documento ────────────────────────────────────────────────────
function DocumentEditor({
  doc, index, total, config, onChange, onMove, onRemove,
}: {
  doc: DocumentConfig;
  index: number;
  total: number;
  config: FormConfig;
  onChange: (d: DocumentConfig) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const ctype = conditionType(doc.condition);
  const cvalues = conditionValues(doc.condition);
  const valueOptions =
    ctype === "gender" ? config.genderOptions : ctype === "marital" ? config.maritalOptions : [];

  function toggleValue(v: string) {
    const next = cvalues.includes(v) ? cvalues.filter((x) => x !== v) : [...cvalues, v];
    onChange({ ...doc, condition: buildCondition(ctype, next) });
  }

  function updateExtra(i: number, patch: Partial<ExtraFieldConfig>) {
    const fields = (doc.extraFields ?? []).map((f, j) => (j === i ? { ...f, ...patch } : f));
    onChange({ ...doc, extraFields: fields });
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/60">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <label className={label}>Nome do documento</label>
          <input className={input} value={doc.label} onChange={(e) => onChange({ ...doc, label: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1 pt-5">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Subir">
            <ArrowUp className="w-4 h-4" />
          </button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Descer">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
        <button type="button" onClick={onRemove}
          className="pt-5 text-gray-400 hover:text-red-500 transition-colors" aria-label="Excluir documento">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Chave interna (key)</label>
          <input className={input} value={doc.key}
            onChange={(e) => onChange({ ...doc, key: e.target.value.trim() })} />
        </div>
        <div>
          <label className={label}>Quando exibir</label>
          <select
            className={input}
            value={ctype}
            onChange={(e) => onChange({ ...doc, condition: buildCondition(e.target.value as ConditionType, cvalues) })}
          >
            {CONDITION_TYPES.map((t) => (
              <option key={t} value={t}>{CONDITION_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {(ctype === "gender" || ctype === "marital") && (
        <div>
          <label className={label}>Exibir quando a resposta for uma destas</label>
          <div className="flex flex-wrap gap-2">
            {valueOptions.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggleValue(v)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  cvalues.includes(v)
                    ? "bg-wg-green text-white border-wg-green"
                    : "bg-white text-gray-700 border-gray-300 hover:border-wg-green"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={doc.required}
          onChange={(e) => onChange({ ...doc, required: e.target.checked })}
          className="rounded border-gray-300 text-wg-green focus:ring-wg-green" />
        Obrigatório
      </label>

      {/* Campos extras (texto) */}
      {(doc.extraFields ?? []).length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold text-gray-500">Campos de texto adicionais</p>
          {(doc.extraFields ?? []).map((f, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className={label}>Rótulo</label>
                  <input className={input} value={f.label} onChange={(e) => updateExtra(i, { label: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Chave (key)</label>
                  <input className={input} value={f.key} onChange={(e) => updateExtra(i, { key: e.target.value.trim() })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className={label}>Placeholder</label>
                  <input className={input} value={f.placeholder ?? ""} onChange={(e) => updateExtra(i, { placeholder: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Máscara</label>
                  <select className={input} value={f.mask ?? "none"} onChange={(e) => updateExtra(i, { mask: e.target.value as ExtraFieldConfig["mask"] })}>
                    <option value="none">Nenhuma</option>
                    <option value="pis">PIS (000.00000.00-0)</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={f.required} onChange={(e) => updateExtra(i, { required: e.target.checked })}
                    className="rounded border-gray-300 text-wg-green focus:ring-wg-green" />
                  Obrigatório
                </label>
                <button type="button"
                  onClick={() => onChange({ ...doc, extraFields: (doc.extraFields ?? []).filter((_, j) => j !== i) })}
                  className="text-xs text-red-500 hover:underline inline-flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Remover campo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...doc,
            extraFields: [...(doc.extraFields ?? []), { key: "", label: "", required: false, mask: "none" }],
          })
        }
        className="inline-flex items-center gap-1 text-xs font-medium text-wg-green-dark hover:underline"
      >
        <Plus className="w-3.5 h-3.5" /> Adicionar campo de texto
      </button>
    </div>
  );
}

// ─── Editor principal ──────────────────────────────────────────────────────────
export function FormConfigEditor({ initial }: { initial: FormConfig }) {
  const [config, setConfig] = useState<FormConfig>(initial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function set<K extends keyof FormConfig>(key: K, value: FormConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
    setFeedback(null);
  }
  function setLabel<K extends keyof FormConfig["labels"]>(key: K, value: string) {
    setConfig((c) => ({ ...c, labels: { ...c.labels, [key]: value } }));
    setFeedback(null);
  }

  function updateDoc(i: number, d: DocumentConfig) {
    set("documents", config.documents.map((x, j) => (j === i ? d : x)));
  }
  function moveDoc(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= config.documents.length) return;
    const next = [...config.documents];
    [next[i], next[j]] = [next[j], next[i]];
    set("documents", next);
  }
  function removeDoc(i: number) {
    set("documents", config.documents.filter((_, j) => j !== i));
  }
  function addDoc() {
    set("documents", [
      ...config.documents,
      { key: `doc_${Date.now()}`, label: "Novo documento", required: false, condition: { type: "always" } },
    ]);
  }

  function handleSave() {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveFormConfig(config);
      if (res.ok) setFeedback({ ok: true, msg: "Configuração salva com sucesso." });
      else setFeedback({ ok: false, msg: res.error });
    });
  }

  function handleReset() {
    if (confirm("Restaurar a configuração padrão? As alterações não salvas serão perdidas.")) {
      setConfig(structuredClone(DEFAULT_FORM_CONFIG));
      setFeedback(null);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl pb-24">
      {/* Cabeçalho */}
      <div className={card}>
        <h2 className={section}>Cabeçalho e boas-vindas</h2>
        <div className="space-y-3">
          <div>
            <label className={label}>Título</label>
            <input className={input} value={config.header.title}
              onChange={(e) => set("header", { ...config.header, title: e.target.value })} />
          </div>
          <div>
            <label className={label}>Subtítulo</label>
            <input className={input} value={config.header.subtitle}
              onChange={(e) => set("header", { ...config.header, subtitle: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Perguntas */}
      <div className={card}>
        <h2 className={section}>Rótulos das perguntas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={label}>Estado civil</label>
            <input className={input} value={config.labels.maritalStatus} onChange={(e) => setLabel("maritalStatus", e.target.value)} /></div>
          <div><label className={label}>Possui filhos</label>
            <input className={input} value={config.labels.hasChildren} onChange={(e) => setLabel("hasChildren", e.target.value)} /></div>
          <div><label className={label}>Vale-transporte</label>
            <input className={input} value={config.labels.needsTransportVoucher} onChange={(e) => setLabel("needsTransportVoucher", e.target.value)} /></div>
          <div><label className={label}>Detalhes do vale-transporte</label>
            <input className={input} value={config.labels.transportVoucherDetails} onChange={(e) => setLabel("transportVoucherDetails", e.target.value)} /></div>
          <div><label className={label}>Conta Itaú</label>
            <input className={input} value={config.labels.hasItauAccount} onChange={(e) => setLabel("hasItauAccount", e.target.value)} /></div>
          <div><label className={label}>Autodeclaração de cor</label>
            <input className={input} value={config.labels.colorDeclaration} onChange={(e) => setLabel("colorDeclaration", e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={label}>Cargo (Motorista/Operador)</label>
            <input className={input} value={config.labels.isDriverOperator} onChange={(e) => setLabel("isDriverOperator", e.target.value)} /></div>
        </div>
      </div>

      {/* Opções */}
      <div className={card}>
        <h2 className={section}>Opções de resposta</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Gênero</p>
            <StringListEditor values={config.genderOptions} onChange={(v) => set("genderOptions", v)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Estado civil</p>
            <StringListEditor values={config.maritalOptions} onChange={(v) => set("maritalOptions", v)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Autodeclaração de cor</p>
            <StringListEditor values={config.colorOptions} onChange={(v) => set("colorOptions", v)} />
          </div>
        </div>
      </div>

      {/* Documentos */}
      <div className={card}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Documentos</h2>
          <button type="button" onClick={addDoc}
            className="inline-flex items-center gap-1 text-sm font-medium bg-wg-green text-white hover:bg-wg-green-dark px-3 py-1.5 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Novo documento
          </button>
        </div>
        <div className="space-y-3">
          {config.documents.map((doc, i) => (
            <DocumentEditor
              key={i}
              doc={doc}
              index={i}
              total={config.documents.length}
              config={config}
              onChange={(d) => updateDoc(i, d)}
              onMove={(dir) => moveDoc(i, dir)}
              onRemove={() => removeDoc(i)}
            />
          ))}
        </div>
      </div>

      {/* Mensagens */}
      <div className={card}>
        <h2 className={section}>Mensagens e avisos</h2>
        <div className="space-y-3">
          <div>
            <label className={label}>Aviso — não possui conta Itaú</label>
            <textarea className={`${input} h-20 resize-none`} value={config.messages.itauWarning}
              onChange={(e) => set("messages", { ...config.messages, itauWarning: e.target.value })} />
          </div>
          <div>
            <label className={label}>Informação — Motorista/Operador</label>
            <textarea className={`${input} h-20 resize-none`} value={config.messages.driverInfo}
              onChange={(e) => set("messages", { ...config.messages, driverInfo: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Tela de sucesso */}
      <div className={card}>
        <h2 className={section}>Tela de conclusão</h2>
        <div className="space-y-3">
          <div>
            <label className={label}>Título</label>
            <input className={input} value={config.success.title}
              onChange={(e) => set("success", { ...config.success, title: e.target.value })} />
          </div>
          <div>
            <label className={label}>Mensagem</label>
            <textarea className={`${input} h-24 resize-none`} value={config.success.body}
              onChange={(e) => set("success", { ...config.success, body: e.target.value })} />
          </div>
          <div>
            <label className={label}>Telefone de contato</label>
            <input className={input} value={config.success.contactPhone}
              onChange={(e) => set("success", { ...config.success, contactPhone: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Barra de ações fixa */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button type="button" onClick={handleSave} disabled={pending}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-wg-green text-white hover:bg-wg-green-dark disabled:opacity-60 px-5 py-2 rounded-lg transition-colors">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar configuração
          </button>
          <button type="button" onClick={handleReset} disabled={pending}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg transition-colors">
            <RotateCcw className="w-4 h-4" /> Restaurar padrão
          </button>
          {feedback && (
            <span className={`inline-flex items-center gap-1.5 text-sm ${feedback.ok ? "text-green-600" : "text-red-600"}`}>
              {feedback.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {feedback.msg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
