"use client";

import { useState } from "react";
import { AlertTriangle, UserPlus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { SettingsField, describedBy, settingsInputClass, settingsSelectClass } from "@/components/internal/settings/fields";
import { BRAZIL_STATES, maskPhone } from "@/lib/utils";
import { checkTalentDuplicate, createTalentAction } from "@/lib/talentos/actions";
import type { DuplicateMatch, TagItem } from "@/lib/talentos/service";
import { TagPicker } from "./TagPicker";
import { TagChip } from "./talent-ui";

interface Props {
  open: boolean;
  onClose: () => void;
  tags: TagItem[];
  onCreateTag: (name: string) => Promise<TagItem | null>;
  /** Abre o perfil (drawer) — do talento criado ou do já existente. */
  onOpenTalent: (id: string) => void;
}

const EMPTY = { nomeCompleto: "", email: "", telefone: "", cidade: "", estado: "", cargoDesejado: "", areaInteresse: "", nota: "" };

/**
 * Cadastro manual de um talento no banco (sem vaga). Verifica duplicidade por e-mail e
 * telefone ANTES de criar — se já existir, oferece abrir o perfil em vez de duplicar.
 */
export function AddTalentDialog({ open, onClose, tags, onCreateTag, onOpenTalent }: Props) {
  const { notify } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = k === "telefone" ? maskPhone(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (k === "email" || k === "telefone") setDuplicate(null);
    setError(null);
  };

  const reset = () => {
    setForm(EMPTY);
    setTagIds([]);
    setError(null);
    setDuplicate(null);
  };

  const close = () => {
    if (saving) return;
    onClose();
  };

  const check = async () => {
    const dup = await checkTalentDuplicate({ email: form.email, telefone: form.telefone }).catch(() => null);
    setDuplicate(dup);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await createTalentAction({ ...form, tagIds });
      if (r.ok) {
        notify("success", "Talento adicionado ao banco.");
        reset();
        onClose();
        onOpenTalent(r.id);
        return;
      }
      setError(r.error);
      if (r.duplicate) setDuplicate(r.duplicate);
    } catch {
      setError("Não foi possível cadastrar o talento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const selectedTags = tags.filter((t) => tagIds.includes(t.id));

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={saving}
      size="lg"
      title="Adicionar talento"
      description="Cadastre alguém que ainda não se candidatou pelo portal. Use apenas dados de pessoas que autorizaram o contato."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="add-talent-form" icon={UserPlus} loading={saving} disabled={Boolean(duplicate)}>
            Adicionar talento
          </Button>
        </>
      }
    >
      <form id="add-talent-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <SettingsField id="t-nome" label="Nome completo" required className="sm:col-span-2">
          <input id="t-nome" required value={form.nomeCompleto} onChange={set("nomeCompleto")} className={settingsInputClass} autoComplete="off" />
        </SettingsField>
        <SettingsField id="t-email" label="E-mail" required>
          <input id="t-email" type="email" required value={form.email} onChange={set("email")} onBlur={check} className={settingsInputClass} autoComplete="off" />
        </SettingsField>
        <SettingsField id="t-tel" label="Telefone" hint="Opcional">
          <input
            id="t-tel"
            inputMode="tel"
            value={form.telefone}
            onChange={set("telefone")}
            onBlur={check}
            placeholder="(41) 9 9999-9999"
            aria-describedby={describedBy("t-tel", { hint: true })}
            className={settingsInputClass}
          />
        </SettingsField>

        {duplicate && (
          <div role="alert" className="flex flex-wrap items-start gap-3 rounded-control border border-warning-border bg-warning-bg px-3 py-2.5 text-meta text-warning-fg sm:col-span-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1">
              {duplicate.matchedBy === "email" ? "Já existe um talento com este e-mail" : "Já existe um talento com este telefone"}:{" "}
              <strong className="font-semibold">{duplicate.nomeCompleto}</strong> ({duplicate.email}).
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const id = duplicate.id;
                reset();
                onClose();
                onOpenTalent(id);
              }}
            >
              Abrir perfil existente
            </Button>
          </div>
        )}

        <SettingsField id="t-cidade" label="Cidade">
          <input id="t-cidade" value={form.cidade} onChange={set("cidade")} className={settingsInputClass} />
        </SettingsField>
        <SettingsField id="t-uf" label="Estado">
          <select id="t-uf" value={form.estado} onChange={set("estado")} className={settingsSelectClass}>
            <option value="">Selecione</option>
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </SettingsField>
        <SettingsField id="t-cargo" label="Cargo de interesse">
          <input id="t-cargo" value={form.cargoDesejado} onChange={set("cargoDesejado")} placeholder="Ex.: Motorista de caminhão" className={settingsInputClass} />
        </SettingsField>
        <SettingsField id="t-area" label="Área de interesse">
          <input id="t-area" value={form.areaInteresse} onChange={set("areaInteresse")} placeholder="Ex.: Logística" className={settingsInputClass} />
        </SettingsField>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-label font-semibold text-wg-ink-secondary">Tags</p>
          {selectedTags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selectedTags.map((t) => (
                <TagChip key={t.id} name={t.name} color={t.color} onRemove={() => setTagIds((ids) => ids.filter((x) => x !== t.id))} />
              ))}
            </div>
          )}
          <TagPicker
            tags={tags}
            selectedIds={tagIds}
            onToggle={(t) => setTagIds((ids) => (ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id]))}
            onCreate={async (name) => {
              const tag = await onCreateTag(name);
              if (tag) setTagIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]));
              return tag;
            }}
          />
        </div>

        <SettingsField id="t-nota" label="Observação inicial" hint="Visível apenas para usuários internos autorizados." className="sm:col-span-2">
          <textarea
            id="t-nota"
            rows={3}
            value={form.nota}
            onChange={set("nota")}
            aria-describedby={describedBy("t-nota", { hint: true })}
            className={settingsInputClass}
          />
        </SettingsField>

        {error && !duplicate && (
          <p role="alert" className="text-meta text-danger-fg sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
