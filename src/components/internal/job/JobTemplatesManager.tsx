"use client";

// Configurações › Modelos de vaga — lista com busca, filtro por área e status, e o editor.
// Simples de propósito: o modelo é um conjunto de textos por seção, não um CMS.
// Não existe exclusão: arquivar tira o modelo do seletor de "Nova vaga"; vagas já criadas
// nunca mudam (o conteúdo foi copiado).

import { useDeferredValue, useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, FilePlus2, MoreHorizontal, Pencil, Plus, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterSelect, SearchField } from "@/components/ui/FilterControls";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { cn, CONTRACT_TYPE_LABELS, MODALITY_LABELS } from "@/lib/utils";
import {
  createJobTemplate,
  duplicateJobTemplate,
  setJobTemplateActive,
  updateJobTemplate,
} from "@/lib/jobs/template-actions";
import { matchesTemplate, type JobTemplate, type JobTemplateInput } from "@/lib/jobs/templates";
import { actionErrorMessage } from "@/lib/action-errors";
import { Field, inputClass } from "./JobFields";

type StatusFilter = "active" | "archived" | "all";
const ALL_AREAS = "__all";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function JobTemplatesManager({ templates }: { templates: JobTemplate[] }) {
  const router = useRouter();
  const { notify } = useToast();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [area, setArea] = useState<string>(ALL_AREAS);
  const [editing, setEditing] = useState<JobTemplate | "new" | null>(null);

  const areas = useMemo(
    () => [...new Set(templates.map((t) => t.department?.trim()).filter((d): d is string => Boolean(d)))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [templates]
  );

  const filtered = useMemo(
    () =>
      templates.filter((t) => {
        if (status === "active" && !t.active) return false;
        if (status === "archived" && t.active) return false;
        if (area !== ALL_AREAS && (t.department ?? "").trim() !== area) return false;
        return matchesTemplate(t, deferredQuery);
      }),
    [templates, status, area, deferredQuery]
  );

  const archivedCount = templates.filter((t) => !t.active).length;

  function run(label: string, fn: () => Promise<{ ok: true; template: JobTemplate } | { ok: false; error: string }>) {
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof fn>>;
      try {
        res = await fn();
      } catch (e) {
        console.error("[modelos-vaga]", e);
        return notify("error", actionErrorMessage(e));
      }
      if (!res.ok) return notify("error", res.error);
      notify("success", label.replace("{name}", res.template.name));
      router.refresh();
    });
  }

  function menu(t: JobTemplate): DropdownMenuItem[] {
    return [
      { label: "Editar", icon: Pencil, onSelect: () => setEditing(t) },
      { label: "Duplicar", icon: Copy, onSelect: () => run("Modelo duplicado: “{name}”.", () => duplicateJobTemplate(t.id)) },
      { type: "separator" },
      t.active
        ? { label: "Arquivar", icon: Archive, onSelect: () => run("“{name}” arquivado.", () => setJobTemplateActive(t.id, false)) }
        : { label: "Reativar", icon: ArchiveRestore, onSelect: () => run("“{name}” reativado.", () => setJobTemplateActive(t.id, true)) },
    ];
  }

  return (
    <section className="rounded-card border border-wg-border-lighter bg-white" aria-labelledby="job-templates-title">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 id="job-templates-title" className="font-sora text-section-title text-wg-ink">
              Modelos
            </h2>
            <span className="text-meta text-wg-ink-muted">
              {templates.length} {templates.length === 1 ? "modelo" : "modelos"}
              {archivedCount > 0 && ` · ${archivedCount} arquivado${archivedCount > 1 ? "s" : ""}`}
            </span>
          </div>
          <p className="mt-0.5 text-meta text-wg-ink-muted">
            Também dá para criar um modelo a partir de uma vaga: menu ••• da vaga › Salvar como modelo.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
          Novo modelo
        </Button>
      </header>

      {templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-y border-wg-border-lighter bg-wg-bg/50 px-5 py-2.5">
          <SearchField value={query} onChange={setQuery} placeholder="Buscar por modelo, cargo ou área…" className="sm:max-w-sm" />
          {areas.length > 0 && (
            <FilterSelect
              label="Área"
              value={area}
              onChange={setArea}
              options={[{ value: ALL_AREAS, label: "Todas" }, ...areas.map((a) => ({ value: a, label: a }))]}
            />
          )}
          <SegmentedControl<StatusFilter>
            label="Filtrar por status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "Ativos" },
              { value: "archived", label: "Arquivados" },
              { value: "all", label: "Todos" },
            ]}
          />
          <p className="ml-auto text-label font-normal text-wg-ink-muted" aria-live="polite">
            {filtered.length === templates.length ? "" : `${filtered.length} de ${templates.length}`}
          </p>
        </div>
      )}

      {templates.length === 0 ? (
        <EmptyState
          icon={FilePlus2}
          title="Nenhum modelo de vaga ainda"
          description="Cadastre os cargos que a WG abre com frequência — responsabilidades, requisitos e benefícios ficam prontos para a próxima vaga."
          action={
            <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
              Novo modelo
            </Button>
          }
          className="border-t border-wg-border-lighter"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          compact
          icon={Search}
          title={query ? `Nada encontrado para “${query}”` : "Nenhum modelo neste filtro"}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setArea(ALL_AREAS);
                setStatus("all");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-wg-border-lighter text-label uppercase tracking-[0.06em] text-wg-ink-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  Cargo
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Área
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Última atualização
                </th>
                <th scope="col" className="w-14 px-3 py-2.5 font-semibold">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wg-border-lighter">
              {filtered.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-wg-bg/60">
                  <td className="px-5 py-2.5">
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className={cn(
                        "rounded-sm text-left text-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
                        t.active ? "text-wg-ink hover:text-wg-green-dark" : "text-wg-ink-muted"
                      )}
                    >
                      {t.name}
                    </button>
                    {t.title !== t.name && <p className="text-meta text-wg-ink-muted">{t.title}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-body text-wg-ink-secondary">{t.department || "—"}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge tone={t.active ? "success" : "neutral"}>{t.active ? "Ativo" : "Arquivado"}</StatusBadge>
                  </td>
                  <td className="px-3 py-2.5 text-meta text-wg-ink-secondary" suppressHydrationWarning>
                    Atualizado em {formatDate(t.updatedAt)}
                    {t.updatedBy && <span className="block text-wg-ink-muted">por {t.updatedBy}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <DropdownMenu
                      trigger={<MoreHorizontal aria-hidden />}
                      ariaLabel={`Ações do modelo ${t.name}`}
                      triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                      items={menu(t)}
                      align="right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TemplateEditorDialog
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        template={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </section>
  );
}

// ─── Editor ─────────────────────────────────────────────────────────────────────────────

function emptyInput(): JobTemplateInput {
  return {
    name: "",
    title: "",
    department: null,
    modality: null,
    contractType: null,
    workSchedule: null,
    about: null,
    responsibilities: null,
    requiredRequirements: null,
    desiredRequirements: null,
    benefits: null,
  };
}

function toInput(t: JobTemplate | null): JobTemplateInput {
  if (!t) return emptyInput();
  const { id: _id, active: _a, updatedAt: _u, updatedBy: _b, ...rest } = t;
  void _id;
  void _a;
  void _u;
  void _b;
  return rest;
}

const CONTENT_FIELDS: Array<{ key: keyof JobTemplateInput; label: string; hint?: string; rows: number }> = [
  { key: "responsibilities", label: "Responsabilidades", rows: 5, hint: "Uma por linha, começando com “- ”." },
  { key: "requiredRequirements", label: "Requisitos obrigatórios", rows: 4 },
  { key: "desiredRequirements", label: "Requisitos desejáveis", rows: 3 },
  { key: "benefits", label: "Benefícios", rows: 4 },
  { key: "about", label: "Sobre a vaga (opcional)", rows: 3, hint: "Texto de abertura, antes das seções." },
];

function TemplateEditorDialog({
  template,
  open,
  onClose,
  onSaved,
}: {
  template: JobTemplate | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const id = useId();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<JobTemplateInput>(() => toInput(template));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [open]);

  const set = (patch: Partial<JobTemplateInput>) => setForm((f) => ({ ...f, ...patch }));
  const str = (v: string | null | undefined) => v ?? "";

  function save() {
    if (form.name.trim().length < 2) return setError("Informe o nome do modelo.");
    if (form.title.trim().length < 2) return setError("Informe o cargo.");
    setError(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof createJobTemplate>>;
      try {
        res = template ? await updateJobTemplate(template.id, form) : await createJobTemplate(form);
      } catch (e) {
        console.error("[modelos-vaga]", e);
        return setError(actionErrorMessage(e));
      }
      if (!res.ok) return setError(res.error);
      notify("success", template ? "Modelo atualizado. Vagas já criadas não mudam." : `Modelo “${res.template.name}” criado.`);
      onSaved();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={pending}
      size="lg"
      title={template ? "Editar modelo de vaga" : "Novo modelo de vaga"}
      description={template ? "Alterações valem para as próximas vagas. Vagas já criadas com este modelo não mudam." : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" loading={pending} onClick={save}>
            {template ? "Salvar alterações" : "Criar modelo"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="mb-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-wg-ink-muted">Informações gerais</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do modelo" htmlFor={`${id}-name`} required hint="Como aparece na busca de Nova vaga.">
              <input id={`${id}-name`} value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} className={inputClass} />
            </Field>
            <Field label="Cargo" htmlFor={`${id}-title`} required hint="Vira o título da vaga.">
              <input id={`${id}-title`} value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} className={inputClass} />
            </Field>
            <Field label="Área" htmlFor={`${id}-dep`}>
              <input
                id={`${id}-dep`}
                value={str(form.department)}
                onChange={(e) => set({ department: e.target.value })}
                maxLength={120}
                placeholder="Ex.: Logística"
                className={inputClass}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-wg-ink-muted">Dados padrão</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Modalidade" htmlFor={`${id}-mod`}>
              <select id={`${id}-mod`} value={str(form.modality)} onChange={(e) => set({ modality: e.target.value || null })} className={inputClass}>
                <option value="">Não definir</option>
                {Object.entries(MODALITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de contratação" htmlFor={`${id}-ct`}>
              <select id={`${id}-ct`} value={str(form.contractType)} onChange={(e) => set({ contractType: e.target.value || null })} className={inputClass}>
                <option value="">Não definir</option>
                {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Horário" htmlFor={`${id}-ws`}>
              <input
                id={`${id}-ws`}
                value={str(form.workSchedule)}
                onChange={(e) => set({ workSchedule: e.target.value })}
                maxLength={200}
                placeholder="Ex.: Seg a Sex, 08h–17h"
                className={inputClass}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-wg-ink-muted">Conteúdo da vaga</legend>
          <p className="-mt-1 text-[12px] text-wg-ink-muted">
            Markdown simples: <code className="rounded bg-wg-bg px-1">- item</code> e <code className="rounded bg-wg-bg px-1">**negrito**</code>. Na vaga,
            cada bloco vira uma seção (### Responsabilidades, ### Requisitos Obrigatórios…).
          </p>
          {CONTENT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`${id}-${f.key}`} hint={f.hint}>
              <textarea
                id={`${id}-${f.key}`}
                rows={f.rows}
                value={str(form[f.key] as string | null)}
                onChange={(e) => set({ [f.key]: e.target.value } as Partial<JobTemplateInput>)}
                className={cn(inputClass, "h-auto resize-y py-2 font-mono text-[13px] leading-relaxed")}
              />
            </Field>
          ))}
        </fieldset>

        {error && (
          <p role="alert" className="rounded-control border border-danger-border bg-danger-bg px-3 py-2 text-meta text-danger-fg">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
