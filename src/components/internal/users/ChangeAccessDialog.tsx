"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  accessLabel,
  describeAccessChange,
  PERMISSIONS,
  ROLE_PROFILES,
  roleProfile,
  type AccessSubject,
} from "@/lib/access/roles";

export interface AccessTarget {
  id: string;
  name: string;
  email: string;
  role: string;
  isApprover: boolean;
}

/**
 * Alteração de perfil em duas etapas: escolher (perfil + permissão adicional) e confirmar,
 * vendo exatamente o que a pessoa passa a poder e deixa de poder fazer.
 */
export function ChangeAccessDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AccessTarget | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [role, setRole] = useState("VIEWER_RH");
  const [approver, setApprover] = useState(false);
  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setRole(user.role);
    setApprover(user.isApprover);
    setStep("choose");
    setError(null);
  }, [user]);

  if (!user) return null;

  const from: AccessSubject = { role: user.role, isApprover: user.isApprover };
  const to: AccessSubject = { role, isApprover: approver };
  const changed = user.role !== role || user.isApprover !== approver;
  const diff = describeAccessChange(from, to);
  const assignable = ROLE_PROFILES.filter((p) => p.assignable);
  const approverImplied = roleProfile(role).grants.includes("approve_requests");

  async function save() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ role, isApprover: approver }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d.error === "string" ? d.error : "Não foi possível alterar o perfil.");
        return;
      }
      onSaved(`Perfil de ${user.name} alterado para ${accessLabel(to)}.`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={saving}
      size="md"
      title={step === "choose" ? "Alterar perfil de acesso" : "Confirmar alteração"}
      description={
        step === "choose"
          ? "O perfil define o que a pessoa pode ver e fazer no portal."
          : undefined
      }
      footer={
        step === "choose" ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setStep("confirm")} disabled={!changed}>
              Continuar
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep("choose")} disabled={saving}>
              Voltar
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              Confirmar alteração
            </Button>
          </>
        )
      }
    >
      <div className="mb-4 flex items-center gap-3 rounded-card border border-wg-border-lighter bg-wg-bg/50 px-3 py-2.5">
        <UserAvatar name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-record-title text-wg-ink">{user.name}</p>
          <p className="truncate text-meta text-wg-ink-muted">{user.email}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-wg-ink-muted">Perfil atual</p>
          <p className="text-meta font-semibold text-wg-ink">{accessLabel(from)}</p>
        </div>
      </div>

      {step === "choose" ? (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 font-inter text-label uppercase tracking-wide text-wg-ink-muted">Novo perfil</legend>
            <div className="space-y-2">
              {assignable.map((p) => {
                const checked = role === p.key;
                return (
                  <label
                    key={p.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-card border px-3.5 py-3 transition-colors",
                      checked ? "border-wg-green-dark/50 bg-[#F7FBF1]" : "border-wg-border-light hover:border-[#C9D9B4]"
                    )}
                  >
                    <input
                      type="radio"
                      name="access-role"
                      value={p.key}
                      checked={checked}
                      onChange={() => setRole(p.key)}
                      className="mt-1 h-4 w-4 accent-[#4F6930]"
                    />
                    <span className="min-w-0">
                      <span className="block text-body font-semibold text-wg-ink">
                        {p.label}
                        {user.role === p.key && <span className="ml-2 text-meta font-normal text-wg-ink-muted">(atual)</span>}
                      </span>
                      <span className="block text-meta text-wg-ink-muted">{p.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-inter text-label uppercase tracking-wide text-wg-ink-muted">Permissão adicional</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-card border border-wg-border-light px-3.5 py-3 hover:border-[#C9D9B4]">
              <input
                type="checkbox"
                checked={approver}
                onChange={(e) => setApprover(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#4F6930]"
              />
              <span>
                <span className="block text-body font-semibold text-wg-ink">
                  {approverImplied ? "Aprovador padrão de solicitações" : PERMISSIONS.approve_requests.label}
                </span>
                <span className="block text-meta text-wg-ink-muted">
                  {approverImplied
                    ? "O administrador já pode aprovar; marcado, aparece primeiro na lista de aprovadores."
                    : PERMISSIONS.approve_requests.description}
                </span>
              </span>
            </label>
          </fieldset>

          <p className="text-[12px] leading-snug text-wg-ink-muted">
            Os perfis Analista RH e Aprovador dedicado estão em preparação. Hoje, o aprovador é um Visualizador com a
            permissão adicional acima.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-body text-wg-ink">
            Alterar <strong className="font-semibold">{user.name}</strong> de{" "}
            <strong className="font-semibold">{accessLabel(from)}</strong> para{" "}
            <strong className="font-semibold">{accessLabel(to)}</strong>?
          </p>
          <div className="flex items-center gap-2 text-meta">
            <span className="rounded-full border border-wg-border-light px-2.5 py-0.5 text-wg-ink-muted">{accessLabel(from)}</span>
            <ArrowRight className="h-4 w-4 text-wg-ink-muted" aria-hidden />
            <span className="rounded-full border border-wg-green-dark/40 bg-[#F7FBF1] px-2.5 py-0.5 font-semibold text-wg-ink">{accessLabel(to)}</span>
          </div>
          {diff.gained.length === 0 && diff.lost.length === 0 ? (
            <p className="flex items-center gap-2 text-meta text-wg-ink-muted">
              <Check className="h-4 w-4" aria-hidden /> As permissões efetivas não mudam.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {diff.gained.length > 0 && (
                <div className="rounded-card border border-success-border bg-success-bg/60 px-3 py-2.5">
                  <p className="mb-1 text-label uppercase tracking-wide text-success-fg">Passa a poder</p>
                  <ul className="space-y-1">
                    {diff.gained.map((g) => (
                      <li key={g} className="flex items-start gap-1.5 text-meta text-wg-ink">
                        <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-fg" aria-hidden />
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {diff.lost.length > 0 && (
                <div className="rounded-card border border-danger-border bg-danger-bg/60 px-3 py-2.5">
                  <p className="mb-1 text-label uppercase tracking-wide text-danger-fg">Deixa de poder</p>
                  <ul className="space-y-1">
                    {diff.lost.map((l) => (
                      <li key={l} className="flex items-start gap-1.5 text-meta text-wg-ink">
                        <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-fg" aria-hidden />
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <p className="text-[12px] text-wg-ink-muted">
            A mudança vale quando a sessão da pessoa for renovada (no próximo login ou em até 1 hora) e fica
            registrada em Atividades.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-control border border-danger-border bg-danger-bg px-3 py-2 text-meta text-danger-fg">
          {error}
        </p>
      )}
    </Dialog>
  );
}
