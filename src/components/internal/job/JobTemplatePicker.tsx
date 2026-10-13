"use client";

// "Modelo da vaga" — seletor pesquisável na seção "Dados da oportunidade".
//
// Opcional: sem modelo, nada muda. Ao escolher, o modelo é COPIADO para o rascunho pelas
// regras puras de src/lib/jobs/templates.ts:
//   • campo vindo da solicitação aprovada nunca é sobrescrito;
//   • campo já preenchido só muda com "Substituir conteúdo com o modelo";
//   • o resto (vazio) recebe o valor do modelo.
// Nada é salvo aqui — o RH revisa e salva/cria a vaga normalmente.

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, LayoutTemplate, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";
import {
  applyTemplate,
  matchesTemplate,
  planTemplate,
  revertTemplate,
  type ApplyMode,
  type ApplyOptions,
  type JobTemplate,
  type TemplatePlan,
  type TemplateTarget,
} from "@/lib/jobs/templates";
import { Field } from "./JobFields";

interface Props<T extends TemplateTarget> {
  /** Todos os modelos (arquivados servem só para mostrar o nome do modelo já aplicado). */
  templates: JobTemplate[];
  draft: T;
  onDraftChange: (next: T) => void;
  /** Campos que vieram da solicitação aprovada (nunca sobrescritos pelo modelo). */
  protectedFields?: ReadonlySet<string>;
  /** Valores iniciais de "Nova vaga" que contam como vazios. */
  defaults?: ApplyOptions["defaults"];
  /** Código da solicitação de origem, para os avisos. */
  requestCode?: string | null;
}

type Session<T> = { template: JobTemplate; before: T; after: T };
type Pending<T> = { template: JobTemplate; base: T; plan: TemplatePlan };

export function JobTemplatePicker<T extends TemplateTarget>({
  templates,
  draft,
  onDraftChange,
  protectedFields,
  defaults,
  requestCode,
}: Props<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picking, setPicking] = useState(false);
  const [session, setSession] = useState<Session<T> | null>(null);
  const [pending, setPending] = useState<Pending<T> | null>(null);
  const [announce, setAnnounce] = useState("");

  const opts: ApplyOptions = { protectedFields, defaults };
  const activeTemplates = useMemo(() => templates.filter((t) => t.active), [templates]);
  const filtered = useMemo(() => activeTemplates.filter((t) => matchesTemplate(t, query)), [activeTemplates, query]);

  // Modelo aplicado: o desta sessão ou o gravado na vaga (procedência).
  const applied = session?.template ?? templates.find((t) => t.id === draft.templateId) ?? null;
  const showPicker = picking || !applied;
  const fromRequest = Boolean(protectedFields && protectedFields.size > 0);

  function apply(base: T, template: JobTemplate, mode: ApplyMode) {
    const { draft: next } = applyTemplate(base, template, mode, opts);
    onDraftChange(next);
    setSession({ template, before: base, after: next });
    setPending(null);
    setPicking(false);
    setQuery("");
    setOpen(false);
    setAnnounce(`Modelo aplicado: ${template.name}.`);
  }

  function choose(template: JobTemplate) {
    // Trocar: desfaz o modelo anterior (o que o RH não mexeu) antes de aplicar o novo.
    const base = session ? revertTemplate(draft, session.before, session.after) : draft;
    const plan = planTemplate(base, template, opts);
    setOpen(false);
    if (plan.needsConfirmation) setPending({ template, base, plan });
    else apply(base, template, "fill");
  }

  function remove() {
    if (session) onDraftChange(revertTemplate(draft, session.before, session.after));
    else onDraftChange({ ...draft, templateId: null });
    setSession(null);
    setPicking(false);
    setAnnounce("Modelo removido.");
  }

  if (activeTemplates.length === 0 && !applied) {
    return (
      <Field label="Modelo da vaga">
        <p className="rounded-control border border-dashed border-wg-border-light bg-wg-bg/60 px-3 py-2.5 text-meta text-wg-ink-muted">
          Nenhum modelo cadastrado.{" "}
          <Link href="/configuracoes/modelos-vaga" className="font-semibold text-wg-green-dark hover:underline">
            Criar modelos de vaga
          </Link>{" "}
          para não redigitar responsabilidades, requisitos e benefícios de cargos recorrentes.
        </p>
      </Field>
    );
  }

  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {!showPicker && applied ? (
        <Field label="Modelo da vaga">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-wg-border-light bg-wg-sidebar/40 px-3 py-2">
            <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-wg-ink">
              <BadgeCheck className="h-4 w-4 shrink-0 text-wg-green-dark" aria-hidden />
              <span className="min-w-0">
                Modelo aplicado: <strong className="font-semibold">{applied.name}</strong>
                {!applied.active && <span className="text-wg-ink-muted"> (arquivado)</span>}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                icon={RefreshCw}
                onClick={() => {
                  setPicking(true);
                  setOpen(true);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              >
                Trocar modelo
              </Button>
              <Button
                size="sm"
                variant="tertiary"
                icon={X}
                onClick={remove}
                title={
                  session
                    ? "Desfaz o que o modelo preencheu (o que você editou depois fica)."
                    : "Tira a indicação do modelo. O conteúdo já copiado continua na vaga."
                }
              >
                Remover modelo
              </Button>
            </span>
          </div>
        </Field>
      ) : (
        <Field
          label="Modelo da vaga"
          htmlFor={`${id}-input`}
          hint={
            fromRequest
              ? `Opcional. O modelo complementa o conteúdo; campos vindos da solicitação${requestCode ? ` ${requestCode}` : ""} não são alterados.`
              : "Opcional. Preenche cargo, dados padrão e o conteúdo recorrente — o que é desta abertura fica com você."
          }
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wg-ink-muted" aria-hidden />
            <input
              ref={inputRef}
              id={`${id}-input`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setActive((a) => Math.min(a + 1, Math.max(filtered.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  if (open && filtered[active]) {
                    e.preventDefault();
                    choose(filtered[active]);
                  }
                } else if (e.key === "Escape") {
                  if (open) {
                    e.stopPropagation();
                    setOpen(false);
                  } else if (picking) setPicking(false);
                }
              }}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
              placeholder="Selecione um modelo ou continue sem modelo"
              autoComplete="off"
              className="h-9 w-full rounded-control border border-wg-border-light bg-white pl-9 pr-3 text-sm text-wg-ink placeholder:text-wg-ink-muted/70 transition-colors hover:border-[#C9D9B4] focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30"
            />
            {open && (
              <ul
                id={listId}
                role="listbox"
                aria-label="Modelos de vaga"
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-control border border-wg-border-lighter bg-white py-1 shadow-[0_8px_24px_rgba(26,34,19,.12)]"
              >
                {filtered.map((t, i) => (
                  <li
                    key={t.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(t)}
                    onMouseEnter={() => setActive(i)}
                    className={cn("flex cursor-pointer items-start gap-2.5 px-3 py-2", i === active && "bg-wg-bg")}
                  >
                    <LayoutTemplate className="mt-0.5 h-4 w-4 shrink-0 text-wg-ink-muted" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-wg-ink">{t.name}</span>
                      <span className="block truncate text-[12px] text-wg-ink-muted">
                        {[t.title !== t.name ? t.title : null, t.department].filter(Boolean).join(" · ") || "Sem área definida"}
                      </span>
                    </span>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-meta text-wg-ink-muted">Nenhum modelo encontrado para “{query}”.</li>
                )}
              </ul>
            )}
          </div>
          {picking && (
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="mt-1 text-[12px] font-medium text-wg-ink-muted hover:text-wg-ink"
            >
              Manter “{applied?.name}”
            </button>
          )}
        </Field>
      )}

      {/* ── Já existe conteúdo: nunca sobrescrever em silêncio ── */}
      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        size="md"
        title="Esta vaga já possui conteúdo preenchido."
        description={pending ? `O modelo “${pending.template.name}” tem informações diferentes das que já estão na vaga.` : undefined}
        initialFocus="[data-default-action]"
        footer={
          pending && (
            <>
              <Button variant="tertiary" onClick={() => setPending(null)}>
                Cancelar
              </Button>
              <Button variant="secondary" onClick={() => apply(pending.base, pending.template, "replace")}>
                Substituir conteúdo com o modelo
              </Button>
              <Button variant="primary" data-default-action onClick={() => apply(pending.base, pending.template, "fill")}>
                Aplicar somente nos campos vazios
              </Button>
            </>
          )
        }
      >
        {pending && <ConflictSummary plan={pending.plan} requestCode={requestCode} />}
      </Dialog>
    </div>
  );
}

function ConflictSummary({ plan, requestCode }: { plan: TemplatePlan; requestCode?: string | null }) {
  const filled = plan.fields.filter((f) => f.status === "conflict").map((f) => f.label);
  const empty = plan.fields.filter((f) => f.status === "fill").map((f) => f.label);
  if (plan.content.status === "fill") empty.push("Conteúdo da vaga");
  return (
    <div className="space-y-3 text-body text-wg-ink-secondary">
      {plan.protectedConflicts.length > 0 && (
        <div className="rounded-control border border-info-border bg-info-bg px-3 py-2 text-meta text-info-fg">
          <p className="font-semibold">Este campo já possui uma informação da solicitação{requestCode ? ` ${requestCode}` : ""}.</p>
          <p className="mt-0.5">
            {plan.protectedConflicts.join(", ")} — {plan.protectedConflicts.length === 1 ? "fica" : "ficam"} como está em
            qualquer opção. Para mudar, edite o campo manualmente.
          </p>
        </div>
      )}
      {(filled.length > 0 || plan.content.status === "conflict") && (
        <div>
          <p className="font-medium text-wg-ink">Já preenchido na vaga</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {filled.map((l) => (
              <li key={l}>{l}</li>
            ))}
            {plan.content.status === "conflict" && (
              <li>
                Conteúdo da vaga
                {plan.content.kept.length > 0 && (
                  <span className="text-wg-ink-muted"> — seções com texto: {plan.content.kept.join(", ")}</span>
                )}
              </li>
            )}
          </ul>
        </div>
      )}
      {empty.length > 0 && (
        <p>
          <span className="font-medium text-wg-ink">Vazios que o modelo preenche:</span> {empty.join(", ")}.
        </p>
      )}
      <p className="text-meta text-wg-ink-muted">
        <strong className="font-semibold text-wg-ink-secondary">Aplicar somente nos campos vazios</strong> mantém tudo o que já foi
        escrito e completa as seções em branco. <strong className="font-semibold text-wg-ink-secondary">Substituir</strong> troca os
        campos preenchidos e o conteúdo pelo texto do modelo.
      </p>
    </div>
  );
}
