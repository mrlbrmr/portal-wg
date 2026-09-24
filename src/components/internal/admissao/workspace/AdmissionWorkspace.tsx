"use client";

// Central da admissão — /admissoes/[id]?aba=…
//
//   Cabeçalho (quem, para onde, etapa, início, responsável)
//   ├─ Abas: Visão geral · Dados pessoais · Contratação · Documentos · Benefícios e recursos · Histórico
//   └─ Sidebar operacional (status, formulário, pendências, progresso) — fixa no desktop
//
// Leitura por padrão. Cada seção entra em edição sozinha ("Editar"); um único rascunho
// atravessa as abas e a barra inferior aparece só quando há alteração. O salvamento usa
// o PATCH /api/admissoes/[id] de sempre (mesmo contrato do formulário antigo).

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Copy, FileText, Trash2, Users } from "lucide-react";
import type { DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/ToastProvider";
import { SettingsSaveBar } from "@/components/internal/settings/SettingsSaveBar";
import { cn } from "@/lib/utils";
import {
  ADMISSION_TABS,
  FIELD_SECTION,
  SECTION_TAB,
  admissionToDraft,
  changedFields,
  draftToPayload,
  validateDraft,
  type AdmissionDraft,
  type AdmissionSection,
  type AdmissionTab,
  type DraftField,
} from "@/lib/admissao/workspace";
import { AdmissionWorkspaceProvider, type AdmissionWorkspaceState } from "./context";
import type { AdmissionWorkspaceData, WorkspaceOptions } from "./types";
import { AdmissionHeader } from "./AdmissionHeader";
import { AdmissionSidebar } from "./AdmissionSidebar";
import { AdmissionOverview } from "./AdmissionOverview";
import { AdmissionPersonalData } from "./AdmissionPersonalData";
import { AdmissionEmploymentData } from "./AdmissionEmploymentData";
import { AdmissionResources } from "./AdmissionResources";
import { AdmissionDeleteDialog } from "./AdmissionDeleteDialog";

const SAVE_ERROR = "Não foi possível salvar as alterações.";
const ALL_SECTIONS: AdmissionSection[] = ["pessoais", "contratacao", "recursos", "notas"];
const EDITABLE_TABS: AdmissionTab[] = ["dados", "contratacao", "recursos"];

interface Props {
  data: AdmissionWorkspaceData;
  options: WorkspaceOptions;
  canManage: boolean;
  initialTab: AdmissionTab;
  /** Abre já em edição (links antigos para /admissoes/[id]/editar). */
  startEditing?: boolean;
  /** Blocos renderizados no servidor. */
  documents: ReactNode;
  formAnswers: ReactNode;
  recentActivity: ReactNode;
  history: ReactNode;
}

export function AdmissionWorkspace({ data, options, canManage, initialTab, startEditing, documents, formAnswers, recentActivity, history }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const tabsId = useId();
  const tabRefs = useRef(new Map<AdmissionTab, HTMLButtonElement>());

  const serverDraft = useMemo(() => admissionToDraft(data.record), [data.record]);
  const [draft, setDraft] = useState<AdmissionDraft>(serverDraft);
  const [saved, setSaved] = useState<AdmissionDraft>(serverDraft);
  const [editing, setEditing] = useState<Set<AdmissionSection>>(() => new Set(canManage && startEditing ? ALL_SECTIONS : []));
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [tab, setTabState] = useState<AdmissionTab>(initialTab);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isDirty = useMemo(() => changedFields(draft, saved).length > 0, [draft, saved]);

  // Dados novos do servidor (router.refresh após salvar, mudar etapa, gerar link): sem
  // alterações pendentes, o rascunho acompanha o que está gravado.
  const serverKey = JSON.stringify(serverDraft);
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  useEffect(() => {
    if (dirtyRef.current) return;
    setDraft(serverDraft);
    setSaved(serverDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const setTab = useCallback((next: AdmissionTab, focus = false) => {
    setTabState(next);
    if (focus) tabRefs.current.get(next)?.focus();
    const url = new URL(window.location.href);
    if (next === "visao-geral") url.searchParams.delete("aba");
    else url.searchParams.set("aba", next);
    url.searchParams.delete("editar");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  // Remove ?editar=1 da URL depois de abrir (recarregar não reabre a edição).
  useEffect(() => {
    if (!startEditing) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("editar");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [startEditing]);

  const patch = useCallback((p: Partial<AdmissionDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setErrors((e) => {
      const keys = Object.keys(p) as DraftField[];
      if (!keys.some((k) => e[k])) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
  }, []);

  const startEdit = useCallback((s: AdmissionSection) => setEditing((prev) => new Set(prev).add(s)), []);

  const cancelEdit = useCallback(
    (s: AdmissionSection) => {
      const fields = (Object.keys(FIELD_SECTION) as DraftField[]).filter((f) => FIELD_SECTION[f] === s);
      setDraft((d) => {
        const next = { ...d };
        for (const f of fields) next[f] = saved[f];
        return next;
      });
      setErrors((e) => {
        const next = { ...e };
        for (const f of fields) delete next[f];
        return next;
      });
      setEditing((prev) => {
        const next = new Set(prev);
        next.delete(s);
        return next;
      });
    },
    [saved]
  );

  const discard = useCallback(() => {
    setDraft(saved);
    setErrors({});
    setEditing(new Set());
  }, [saved]);

  const save = useCallback(async () => {
    if (saving) return;
    const found = validateDraft(draft, saved);
    const invalid = Object.keys(found) as DraftField[];
    if (invalid.length > 0) {
      setErrors(found);
      const sections = new Set(invalid.map((f) => FIELD_SECTION[f]));
      setEditing((prev) => new Set([...prev, ...sections]));
      setTab(SECTION_TAB[FIELD_SECTION[invalid[0]]]);
      notify("error", invalid.length === 1 ? found[invalid[0]]! : "Revise os campos destacados antes de salvar.");
      requestAnimationFrame(() => document.getElementById(fieldId(invalid[0]))?.focus());
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admissoes/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(draft)),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        notify("error", body.error && body.error !== SAVE_ERROR ? `${SAVE_ERROR} ${body.error}` : SAVE_ERROR);
        return;
      }
      setSaved(draft);
      setErrors({});
      setEditing(new Set());
      setSavedAt(Date.now());
      notify("success", "Alterações salvas.");
      router.refresh();
    } catch {
      notify("error", `${SAVE_ERROR} Verifique a conexão e tente novamente.`);
    } finally {
      setSaving(false);
    }
  }, [saving, draft, saved, data.id, notify, router, setTab]);

  const editAll = useCallback(() => {
    setEditing(new Set(ALL_SECTIONS));
    if (!EDITABLE_TABS.includes(tab)) setTab("contratacao");
  }, [tab, setTab]);

  const state: AdmissionWorkspaceState = {
    data,
    options,
    canManage,
    draft,
    saved,
    patch,
    errors,
    isEditing: (s) => canManage && editing.has(s),
    startEdit,
    cancelEdit,
    isDirty,
    setTab,
  };

  // ── Mais ações: só o que o backend suporta ────────────────────────────────────────────
  const menu: DropdownMenuItem[] = [];
  if (canManage && data.form.currentUrl) {
    const url = data.form.currentUrl;
    menu.push({
      label: "Copiar link do formulário",
      icon: Copy,
      onSelect: () =>
        navigator.clipboard.writeText(url).then(
          () => notify("success", "Link copiado."),
          () => notify("error", "Não foi possível copiar.")
        ),
    });
  }
  if (data.form.submittedAt) menu.push({ label: "Ver respostas do formulário", icon: FileText, onSelect: () => setTab("dados") });
  if (data.origin.job) menu.push({ label: "Abrir vaga de origem", icon: ArrowUpRight, href: `/vagas/${data.origin.job.id}/editar` });
  if (data.origin.candidateHref) menu.push({ label: "Ver candidato no pipeline", icon: Users, href: data.origin.candidateHref });
  if (canManage) {
    if (menu.length > 0) menu.push({ type: "separator" });
    menu.push({ label: "Excluir admissão", icon: Trash2, danger: true, onSelect: () => setDeleteOpen(true) });
  }

  const badge = (t: AdmissionTab): { text: string; tone: "warning" | "neutral" } | null => {
    if (t === "documentos" && data.docs.attention > 0) return { text: String(data.docs.attention), tone: "warning" };
    if (t === "dados" && !data.form.submittedAt) return { text: "Aguardando", tone: "neutral" };
    if (t === "historico" && data.historyCount > 0) return { text: String(data.historyCount), tone: "neutral" };
    return null;
  };
  const tabHasChanges = (t: AdmissionTab) =>
    changedFields(draft, saved).some((f) => SECTION_TAB[FIELD_SECTION[f]] === t);

  return (
    <AdmissionWorkspaceProvider value={state}>
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <AdmissionHeader menu={menu} onEdit={canManage && editing.size === 0 ? editAll : undefined} />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6">
          {/* Sidebar: primeiro no DOM (no celular vira blocos logo abaixo do cabeçalho). */}
          <aside
            aria-label="Situação da admissão"
            className="min-w-0 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:[scrollbar-width:thin]"
          >
            <AdmissionSidebar />
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <div
              role="tablist"
              aria-label="Seções da admissão"
              className="flex gap-1 overflow-x-auto border-b border-wg-border-lighter [scrollbar-width:none]"
              onKeyDown={(e) => {
                const i = ADMISSION_TABS.findIndex((t) => t.id === tab);
                let next = -1;
                if (e.key === "ArrowRight") next = (i + 1) % ADMISSION_TABS.length;
                else if (e.key === "ArrowLeft") next = (i - 1 + ADMISSION_TABS.length) % ADMISSION_TABS.length;
                else if (e.key === "Home") next = 0;
                else if (e.key === "End") next = ADMISSION_TABS.length - 1;
                if (next < 0) return;
                e.preventDefault();
                setTab(ADMISSION_TABS[next].id, true);
              }}
            >
              {ADMISSION_TABS.map((t) => {
                const selected = t.id === tab;
                const b = badge(t.id);
                return (
                  <button
                    key={t.id}
                    ref={(el) => {
                      if (el) tabRefs.current.set(t.id, el);
                    }}
                    type="button"
                    role="tab"
                    id={`${tabsId}-${t.id}`}
                    aria-selected={selected}
                    aria-controls={`${tabsId}-panel-${t.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wg-green/50",
                      selected ? "border-wg-green-dark text-wg-ink" : "border-transparent text-wg-ink-muted hover:text-wg-ink"
                    )}
                  >
                    {t.label}
                    {tabHasChanges(t.id) && <span className="h-1.5 w-1.5 rounded-full bg-warning" title="Alterações não salvas" aria-label="com alterações não salvas" />}
                    {b && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                          b.tone === "warning" ? "bg-warning-bg text-warning-fg" : "bg-neutral-bg text-neutral-fg"
                        )}
                      >
                        {b.text}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <TabPanel tabsId={tabsId} id="visao-geral" active={tab}>
              <AdmissionOverview recentActivity={recentActivity} />
            </TabPanel>
            <TabPanel tabsId={tabsId} id="dados" active={tab}>
              <AdmissionPersonalData formAnswers={formAnswers} />
            </TabPanel>
            <TabPanel tabsId={tabsId} id="contratacao" active={tab}>
              <AdmissionEmploymentData />
            </TabPanel>
            <TabPanel tabsId={tabsId} id="documentos" active={tab}>
              {documents}
            </TabPanel>
            <TabPanel tabsId={tabsId} id="recursos" active={tab}>
              <AdmissionResources />
            </TabPanel>
            <TabPanel tabsId={tabsId} id="historico" active={tab}>
              {history}
            </TabPanel>
          </div>
        </div>

        {canManage && (
          <SettingsSaveBar
            autoHide
            isDirty={isDirty}
            isSaving={saving}
            onSave={save}
            onDiscard={discard}
            savedAt={savedAt}
            savedLabel="Alterações salvas"
          />
        )}
      </div>

      {canManage && (
        <AdmissionDeleteDialog admissionId={data.id} name={data.record.fullName} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
      )}
    </AdmissionWorkspaceProvider>
  );
}

/** id do controle de cada campo (para focar o primeiro erro). */
function fieldId(f: DraftField): string {
  const map: Partial<Record<DraftField, string>> = {
    fullName: "adm-fullName",
    cpf: "adm-cpf",
    email: "adm-email",
    phone: "adm-phone",
    birthDate: "adm-birthDate",
  };
  return map[f] ?? "";
}

function TabPanel({ tabsId, id, active, children }: { tabsId: string; id: AdmissionTab; active: AdmissionTab; children: ReactNode }) {
  return (
    <div
      id={`${tabsId}-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`${tabsId}-${id}`}
      hidden={id !== active}
      tabIndex={0}
      className="pt-5 focus-visible:outline-none"
    >
      {children}
    </div>
  );
}
