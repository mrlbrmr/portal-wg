"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/ToastProvider";
import { SettingsField, settingsInputClass } from "@/components/internal/settings/fields";
import { getRegistry } from "@/lib/settings/registry";
import { BRAZIL_STATES } from "@/lib/utils";
import { createCategory, updateCategory, type CatEntity } from "@/lib/admissao/config-actions";
import type { RegistryItem } from "@/lib/admissao/registry-data";

interface Props {
  entity: CatEntity;
  /** null = criar; item = editar. */
  item: RegistryItem | null;
  open: boolean;
  onClose: () => void;
}

const DEFAULT_COLOR: Partial<Record<CatEntity, string>> = { tag: "#64748b", stage: "#94a3b8" };

/** Criar/editar um item de cadastro (nome, cor, obrigatório, status). */
export function RegistryItemDialog({ entity, item, open, onClose }: Props) {
  const reg = getRegistry(entity);
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR[entity] ?? "#64748b");
  const [required, setRequired] = useState(false);
  const [active, setActive] = useState(true);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [uniform, setUniform] = useState(false);
  const [driver, setDriver] = useState(false);
  const [forklift, setForklift] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setColor(item?.color ?? DEFAULT_COLOR[entity] ?? "#64748b");
    setRequired(item?.required ?? false);
    setActive(item?.active ?? true);
    setCity(item?.city ?? "");
    setState(item?.state ?? "");
    setUniform(item?.usesOperationalUniform ?? false);
    setDriver(item?.isDriver ?? false);
    setForklift(item?.isForkliftOperator ?? false);
    setError(null);
  }, [open, item, entity]);

  const hasColor = entity === "tag" || entity === "stage";
  const hasRequired = entity === "documentType";
  const isBranch = entity === "branch";
  const isPosition = entity === "position";
  const extras = isBranch
    ? { city: city.trim() || null, state: state || null }
    : isPosition
      ? { usesOperationalUniform: uniform, isDriver: driver, isForkliftOperator: forklift }
      : {};
  // Etapas têm fluxo próprio de desativação (etapa de conclusão, mover admissões) — botão olho.
  const hasActive = item !== null && item.active !== null && entity !== "stage";
  const dirty =
    !item ||
    name.trim() !== item.name ||
    (hasColor && color !== item.color) ||
    (hasRequired && required !== item.required) ||
    (hasActive && active !== item.active) ||
    (isBranch && ((city.trim() || null) !== item.city || (state || null) !== item.state)) ||
    (isPosition &&
      (uniform !== item.usesOperationalUniform || driver !== item.isDriver || forklift !== item.isForkliftOperator));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError("Informe o nome.");
      return;
    }
    startTransition(async () => {
      const res = item
        ? await updateCategory(entity, item.id, {
            name: clean,
            ...(hasColor ? { color } : {}),
            ...(hasRequired ? { required } : {}),
            ...(hasActive ? { active } : {}),
            ...extras,
          })
        : await createCategory(entity, { name: clean, color: hasColor ? color : undefined, required, ...extras });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      notify(
        "success",
        item ? "Alterações salvas." : `${capitalize(reg.singular)} “${clean}” ${reg.article === "a" ? "criada" : "criado"}.`
      );
      router.refresh();
      onClose();
    });
  }

  const formId = `registry-form-${entity}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={pending}
      title={item ? `Editar ${reg.singular}` : `${reg.article === "a" ? "Nova" : "Novo"} ${reg.singular}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={pending} disabled={!dirty}>
            {item ? "Salvar alterações" : "Adicionar"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <SettingsField
          id={`${formId}-name`}
          label="Nome"
          required
          error={error}
          hint={
            entity === "documentType" && item
              ? "O Formulário de Admissão Digital classifica os anexos pelo nome exato. Ao renomear, ajuste também o documento no formulário."
              : undefined
          }
        >
          <input
            id={`${formId}-name`}
            value={name}
            maxLength={120}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            aria-invalid={!!error}
            className={settingsInputClass}
            placeholder={PLACEHOLDERS[entity]}
          />
        </SettingsField>

        {hasColor && (
          <div className="flex items-center gap-3">
            <label htmlFor={`${formId}-color`} className="text-label font-semibold text-wg-ink-secondary">
              Cor
            </label>
            <input
              id={`${formId}-color`}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded-control border border-wg-border-light bg-white p-0.5"
            />
            <span className="text-label font-normal text-wg-ink-muted">{color.toUpperCase()}</span>
          </div>
        )}

        {hasRequired && (
          <div className="rounded-control border border-wg-border-lighter px-3">
            <Toggle
              label="Obrigatório"
              description="Documentos obrigatórios entram no cálculo de documentos completos da ficha."
              checked={required}
              onChange={() => setRequired((v) => !v)}
            />
          </div>
        )}

        {isBranch && (
          <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
            <SettingsField id={`${formId}-city`} label="Cidade" hint="A vaga desta filial nasce com esta cidade.">
              <input
                id={`${formId}-city`}
                value={city}
                maxLength={120}
                onChange={(e) => setCity(e.target.value)}
                className={settingsInputClass}
                placeholder="Ex.: Nova Iguaçu"
              />
            </SettingsField>
            <SettingsField id={`${formId}-uf`} label="UF">
              <select id={`${formId}-uf`} value={state} onChange={(e) => setState(e.target.value)} className={settingsInputClass}>
                <option value="">—</option>
                {BRAZIL_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </SettingsField>
          </div>
        )}

        {isPosition && (
          <div className="divide-y divide-wg-border-lighter rounded-control border border-wg-border-lighter px-3">
            <Toggle
              label="Usa uniforme operacional (calça e bota)"
              description="Pede o tamanho da calça e da bota no formulário de admissão."
              checked={uniform}
              onChange={() => setUniform((v) => !v)}
            />
            <Toggle
              label="Motorista (pede MOPP)"
              description="Pede o certificado MOPP e a CNH com observação."
              checked={driver}
              onChange={() => setDriver((v) => !v)}
            />
            <Toggle
              label="Operador de empilhadeira"
              description="Pede o certificado de operador de empilhadeira."
              checked={forklift}
              onChange={() => setForklift((v) => !v)}
            />
          </div>
        )}

        {hasActive && (
          <div className="rounded-control border border-wg-border-lighter px-3">
            <Toggle
              label="Ativo"
              description={`Itens inativos não aparecem em novos cadastros, mas continuam nos registros existentes.`}
              checked={active}
              stateLabels={["Ativo", "Inativo"]}
              onChange={() => setActive((v) => !v)}
            />
          </div>
        )}
      </form>
    </Dialog>
  );
}

const PLACEHOLDERS: Record<CatEntity, string> = {
  applicationSource: "Ex.: LinkedIn",
  position: "Ex.: Motorista de Caminhão",
  company: "Ex.: WG Baterias",
  branch: "Ex.: Matriz",
  area: "Ex.: Logística",
  documentType: "Ex.: Comprovante de residência",
  tag: "Ex.: Prioritária",
  stage: "Ex.: Documentação",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
