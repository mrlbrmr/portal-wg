"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Settings, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export interface StageOption {
  id: string;
  name: string;
  color: string;
}

interface Props {
  jobId: string;
  allStages: StageOption[];
  /** IDs das etapas atualmente ativas para esta vaga (vazio = padrão global). */
  activeStageIds: string[];
}

export function JobStageConfigButton({ jobId, allStages, activeStageIds }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function openModal() {
    setSelected(
      activeStageIds.length > 0
        ? new Set(activeStageIds)
        : new Set(allStages.map((s) => s.id))
    );
    setOpen(true);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(stageIds: string[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/vagas/${jobId}/stages`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageIds }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        notify("error", (d as { error?: string }).error ?? "Erro ao salvar.");
        return;
      }
      if (stageIds.length === 0) {
        notify("success", "Etapas redefinidas para o padrão global.");
      } else {
        notify("success", "Configuração de etapas salva.");
      }
      setOpen(false);
      router.refresh();
    } catch {
      notify("error", "Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  const isCustom = activeStageIds.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Configurar etapas do funil para esta vaga"
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-bold transition-colors ${
          isCustom
            ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            : "border-[#DCE8CC] bg-[#EEF4E3] text-[#4F6930] hover:bg-[#E3EDCC]"
        }`}
      >
        <Settings className="w-3.5 h-3.5" />
        {isCustom ? "Etapas personalizadas" : "Configurar etapas"}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !saving && setOpen(false)}
            />
            <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <div>
                  <h2 className="text-[15px] font-extrabold text-[#1A2213]">
                    Etapas do funil
                  </h2>
                  <p className="text-[11.5px] text-[#55614A] mt-0.5">
                    Selecione quais etapas aparecem nesta vaga
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stage list */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
                {allStages.map((stage) => {
                  const checked = selected.has(stage.id);
                  return (
                    <label
                      key={stage.id}
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${
                        checked
                          ? "border-[#90CB46]/50 bg-[#F6FCF0]"
                          : "border-gray-200 bg-gray-50 opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(stage.id)}
                        className="w-4 h-4 rounded accent-[#90CB46] cursor-pointer"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-[13px] font-semibold text-[#1A2213]">
                        {stage.name}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="shrink-0 px-5 py-4 border-t border-gray-100 flex gap-2">
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => save([])}
                    disabled={saving}
                    className="flex-1 rounded-[10px] border border-[#DCE8CC] bg-[#F6F8F3] px-3 py-2.5 text-[12.5px] font-bold text-[#55614A] hover:bg-[#EEF4E3] disabled:opacity-50 transition-colors"
                  >
                    Padrão global
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => save([...selected])}
                  disabled={saving || selected.size === 0}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#90CB46] px-3 py-2.5 text-[12.5px] font-bold text-[#0C0D0C] hover:bg-[#7FD400] disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? "Salvando…" : `Salvar (${selected.size}/${allStages.length})`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
