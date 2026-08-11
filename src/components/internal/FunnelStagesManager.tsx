"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Eye, EyeOff, FlaskConical, Loader2, Plus, Trash2, UserCheck } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createStage,
  deleteStage,
  moveStage,
  renameStage,
  setStageKind,
  setStageTemplate,
  toggleStageActive,
  type StageKind,
} from "@/lib/selection-funnel/config-actions";

export interface FunnelStage {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  kind: StageKind;
  active: boolean;
  templateId: string | null;
}

export interface TemplateOption {
  id: string;
  name: string;
  kind: string;
}

const KIND_LABELS: Record<StageKind, string> = {
  OPEN: "Em processo",
  WON:  "Contratado",
  LOST: "Reprovado",
  TEST: "Teste",
  ADMISSION: "Admissão",
};

interface Props {
  stages: FunnelStage[];
  templates: TemplateOption[];
}

export function FunnelStagesManager({ stages, templates }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, successMsg?: string) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        notify("error", res.error ?? "Não foi possível concluir.");
        return;
      }
      if (successMsg) notify("success", successMsg);
      router.refresh();
    });
  }

  function onAdd() {
    const name = newName.trim();
    if (!name) return;
    run(() => createStage(name), `Etapa "${name}" criada.`);
    setNewName("");
  }

  return (
    <div className="max-w-2xl">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
        {stages.map((s, i) => (
          <div key={s.id} className={`px-4 py-3 ${s.active ? "" : "opacity-50"}`}>
            <div className="flex items-center gap-3">
              {/* reordenar */}
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveStage(s.id, "up"))}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  aria-label="Mover para cima"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={pending || i === stages.length - 1}
                  onClick={() => run(() => moveStage(s.id, "down"))}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  aria-label="Mover para baixo"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {/* nome */}
              <input
                defaultValue={s.name}
                disabled={pending}
                maxLength={120}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.name) run(() => renameStage(s.id, v), "Etapa renomeada.");
                }}
                className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-sm font-medium text-gray-900 hover:border-gray-200 focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30"
              />

              {/* tipo (kind) */}
              <select
                value={s.kind}
                disabled={pending}
                onChange={(e) => run(() => setStageKind(s.id, e.target.value as StageKind), "Tipo atualizado.")}
                className="shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-wg-green focus:outline-none"
                title="Tipo da etapa (usado nas métricas)"
              >
                {(Object.keys(KIND_LABELS) as StageKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>

              {/* ativar/desativar */}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => toggleStageActive(s.id, !s.active), s.active ? "Etapa desativada." : "Etapa reativada.")}
                className="shrink-0 text-gray-400 hover:text-gray-700"
                title={s.active ? "Desativar (some do Kanban)" : "Reativar"}
              >
                {s.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>

              {/* excluir */}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteStage(s.id), "Etapa excluída.")}
                className="shrink-0 text-gray-400 hover:text-red-600"
                title="Excluir etapa"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Informação de integração — visível quando kind = ADMISSION ou WON */}
            {(s.kind === "ADMISSION" || s.kind === "WON") && (
              <div className="mt-2 ml-[52px] flex items-center gap-1.5 text-xs text-indigo-600">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                Ao mover um candidato aqui, o sistema cria automaticamente uma admissão.
              </div>
            )}

            {/* Seletor de template — visível apenas quando kind = TEST */}
            {s.kind === "TEST" && (
              <div className="mt-2 ml-[52px] flex items-center gap-2">
                <FlaskConical className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <select
                  value={s.templateId ?? ""}
                  disabled={pending}
                  onChange={(e) =>
                    run(
                      () => setStageTemplate(s.id, e.target.value || null),
                      e.target.value ? "Teste vinculado." : "Vínculo removido."
                    )
                  }
                  className="flex-1 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs text-purple-800 focus:border-purple-400 focus:outline-none"
                  title="Teste vinculado a esta etapa"
                >
                  <option value="">— Selecione o teste vinculado —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* adicionar */}
      <div className="mt-4 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAdd();
          }}
          placeholder="Nova etapa (ex.: Teste técnico)"
          maxLength={120}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={pending || !newName.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-wg-green px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-wg-green-bright disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Adicionar
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        A etapa só pode ser excluída se nenhum candidato passou por ela; caso contrário, desative-a.
        Etapas do tipo <strong>Teste</strong> podem ter um questionário vinculado do banco de avaliações.
      </p>
    </div>
  );
}
