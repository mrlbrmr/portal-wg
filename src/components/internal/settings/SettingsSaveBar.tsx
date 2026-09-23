"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

export type SaveResult = { ok: true } | { ok: false; error?: string };

const SAVE_ERROR = "Não foi possível salvar as alterações.";

/**
 * Rascunho de uma página de configuração: guarda o valor editado, compara com o
 * último valor salvo (isDirty) e executa o salvamento com o feedback padrão
 * (toast de sucesso/erro). Em caso de erro o rascunho é mantido — nada se perde.
 */
export function useSettingsDraft<T>(initial: T, save: (value: T) => Promise<SaveResult>) {
  const router = useRouter();
  const { notify } = useToast();
  const [value, setValue] = useState<T>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [isSaving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const serialized = useMemo(() => JSON.stringify(value), [value]);
  const isDirty = serialized !== baseline;

  const saveRef = useRef(save);
  saveRef.current = save;

  const submit = useCallback(async () => {
    if (isSaving) return;
    setSaving(true);
    try {
      const res = await saveRef.current(value);
      if (res.ok) {
        setBaseline(JSON.stringify(value));
        setSavedAt(Date.now());
        notify("success", "Configurações salvas.");
        router.refresh();
      } else {
        notify("error", res.error ? `${SAVE_ERROR} ${res.error}` : SAVE_ERROR);
      }
    } catch {
      notify("error", SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }, [isSaving, value, notify, router]);

  const discard = useCallback(() => setValue(JSON.parse(baseline) as T), [baseline]);

  return { value, setValue, isDirty, isSaving, savedAt, save: submit, discard };
}

interface Props {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  /** Volta ao último valor salvo. Sem ele, o botão "Descartar" não aparece. */
  onDiscard?: () => void;
  /** Momento do último salvamento nesta sessão (mostra "Configurações salvas"). */
  savedAt?: number | null;
  /** Ações secundárias à esquerda (ex.: "Restaurar padrão"). */
  extra?: ReactNode;
  saveLabel?: string;
}

/**
 * Barra inferior padrão das páginas editáveis de Configurações: estado do rascunho,
 * "Descartar" e "Salvar alterações" (desabilitado sem alterações). Fica fixa no
 * rodapé da área de conteúdo, protege contra sair sem salvar e aceita Ctrl/⌘+S.
 */
export function SettingsSaveBar({ isDirty, isSaving, onSave, onDiscard, savedAt, extra, saveLabel = "Salvar alterações" }: Props) {
  const { dialog } = useUnsavedChangesGuard(isDirty);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!savedAt) return;
    setJustSaved(true);
    const t = setTimeout(() => setJustSaved(false), 4000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (isDirty && !isSaving) onSaveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDirty, isSaving]);

  return (
    <>
      <div className="sticky bottom-3 z-20 mt-6 md:bottom-4">
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-card border bg-white/95 px-4 py-3 shadow-[0_8px_24px_rgba(26,34,19,.10)] backdrop-blur transition-colors",
            isDirty ? "border-warning-border" : "border-wg-border-lighter"
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <p role="status" aria-live="polite" className="flex items-center gap-2 text-meta">
              {isSaving ? (
                <span className="text-wg-ink-muted">Salvando…</span>
              ) : isDirty ? (
                <>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-warning" aria-hidden />
                  <span className="font-medium text-warning-fg">Alterações não salvas</span>
                </>
              ) : justSaved ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-success-fg">
                  <Check className="h-4 w-4" aria-hidden /> Configurações salvas
                </span>
              ) : (
                <span className="text-wg-ink-muted">Nenhuma alteração pendente</span>
              )}
            </p>
            {extra}
          </div>
          <div className="flex items-center gap-2">
            {onDiscard && isDirty && (
              <Button variant="tertiary" onClick={onDiscard} disabled={isSaving}>
                Descartar
              </Button>
            )}
            <Button
              variant="primary"
              onClick={onSave}
              loading={isSaving}
              disabled={!isDirty}
              title={isDirty ? "Salvar (Ctrl+S)" : "Nenhuma alteração para salvar"}
            >
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>
      {dialog}
    </>
  );
}
