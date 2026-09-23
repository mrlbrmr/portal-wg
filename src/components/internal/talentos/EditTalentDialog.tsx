"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { SettingsField, settingsInputClass, settingsSelectClass } from "@/components/internal/settings/fields";
import { BRAZIL_STATES, maskPhone } from "@/lib/utils";
import type { TalentProfileData } from "@/lib/talentos/profile";

interface Props {
  open: boolean;
  onClose: () => void;
  profile: TalentProfileData;
  onSaved: () => void;
  onOpenTalent?: (id: string) => void;
}

function initial(p: TalentProfileData) {
  return {
    nomeCompleto: p.nomeCompleto,
    email: p.email,
    telefone: p.telefone ?? "",
    cidade: p.cidade ?? "",
    estado: p.estado ?? "",
    cargoDesejado: p.cargoDesejado ?? "",
    areaInteresse: p.areaInteresse ?? "",
    pretensaoSalarial: p.pretensaoSalarial != null ? String(p.pretensaoSalarial) : "",
    linkedinUrl: p.linkedinUrl ?? "",
    resumoProfissional: p.resumoProfissional ?? "",
  };
}

/** Edição dos dados do perfil. Registra "Dados editados" no histórico do talento. */
export function EditTalentDialog({ open, onClose, profile, onSaved, onOpenTalent }: Props) {
  const { notify } = useToast();
  const [form, setForm] = useState(() => initial(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial(profile));
      setError(null);
      setDuplicateId(null);
    }
  }, [open, profile]);

  const set = (k: keyof ReturnType<typeof initial>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: k === "telefone" ? maskPhone(e.target.value) : e.target.value }));
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const salary = form.pretensaoSalarial.replace(/\./g, "").replace(",", ".").trim();
    if (salary && Number.isNaN(Number(salary))) {
      setError("Pretensão salarial inválida.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/talentos/${profile.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, pretensaoSalarial: salary ? Number(salary) : null }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; duplicate?: { id: string } };
      if (!res.ok) {
        setError(j.error ?? "Não foi possível salvar. Tente novamente.");
        setDuplicateId(j.duplicate?.id ?? null);
        return;
      }
      notify("success", "Dados do talento atualizados.");
      onSaved();
      onClose();
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={saving}
      size="lg"
      title="Editar dados do talento"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="edit-talent-form" icon={Save} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="edit-talent-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <SettingsField id="e-nome" label="Nome completo" required className="sm:col-span-2">
          <input id="e-nome" value={form.nomeCompleto} onChange={set("nomeCompleto")} className={settingsInputClass} />
        </SettingsField>
        <SettingsField id="e-email" label="E-mail" required>
          <input id="e-email" type="email" value={form.email} onChange={set("email")} className={settingsInputClass} />
        </SettingsField>
        <SettingsField id="e-tel" label="Telefone">
          <input id="e-tel" inputMode="tel" value={form.telefone} onChange={set("telefone")} className={settingsInputClass} />
        </SettingsField>
        <SettingsField id="e-cidade" label="Cidade">
          <input id="e-cidade" value={form.cidade} onChange={set("cidade")} className={settingsInputClass} />
        </SettingsField>
        <SettingsField id="e-uf" label="Estado">
          <select id="e-uf" value={form.estado} onChange={set("estado")} className={settingsSelectClass}>
            <option value="">Não informado</option>
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </SettingsField>
        <SettingsField id="e-cargo" label="Cargo de interesse">
          <input id="e-cargo" value={form.cargoDesejado} onChange={set("cargoDesejado")} className={settingsInputClass} />
        </SettingsField>
        <SettingsField id="e-area" label="Área de interesse">
          <input id="e-area" value={form.areaInteresse} onChange={set("areaInteresse")} className={settingsInputClass} />
        </SettingsField>
        <SettingsField id="e-pret" label="Pretensão salarial (R$)">
          <input id="e-pret" inputMode="decimal" value={form.pretensaoSalarial} onChange={set("pretensaoSalarial")} className={settingsInputClass} />
        </SettingsField>
        <SettingsField id="e-linkedin" label="LinkedIn">
          <input id="e-linkedin" type="url" value={form.linkedinUrl} onChange={set("linkedinUrl")} placeholder="https://" className={settingsInputClass} />
        </SettingsField>
        <SettingsField id="e-resumo" label="Resumo profissional" className="sm:col-span-2">
          <textarea id="e-resumo" rows={4} value={form.resumoProfissional} onChange={set("resumoProfissional")} className={settingsInputClass} />
        </SettingsField>
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-meta text-danger-fg sm:col-span-2">
            {error}
            {duplicateId && onOpenTalent && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onClose();
                  onOpenTalent(duplicateId);
                }}
              >
                Abrir perfil existente
              </Button>
            )}
          </div>
        )}
      </form>
    </Dialog>
  );
}
