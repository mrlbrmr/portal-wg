"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, Copy, ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { SettingsField, settingsInputClass } from "@/components/internal/settings/fields";
import { formatDate } from "@/lib/utils";
import {
  APPLICATION_STATUS,
  ASSESSMENT_TYPE_LABEL,
  RESULT_SITUATION,
  applicationStatus,
  isBehavioral,
  resultSituation,
} from "@/lib/avaliacoes/presentation";
import { computeValidez, estaVencendoEm30Dias } from "@/lib/talentos/validity";
import type { TalentProfileData, TalentSession } from "@/lib/talentos/profile";

interface Props {
  profile: TalentProfileData;
  canManage: boolean;
  onChanged: () => void;
}

/**
 * Avaliações que o talento realizou (referência às sessões existentes — nada é copiado).
 * Vocabulário e regras de avaliacoes/presentation.ts: comportamental nunca tem nota nem
 * aprovação. Nenhum score de "fit" é calculado aqui.
 */
export function TalentAssessmentsPanel({ profile, canManage, onChanged }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, TalentSession[]>();
    for (const s of profile.sessions) map.set(s.templateId, [...(map.get(s.templateId) ?? []), s]);
    return [...map.values()];
  }, [profile.sessions]);

  const [invalidating, setInvalidating] = useState<TalentSession | null>(null);
  const [inviting, setInviting] = useState<TalentSession | null>(null);

  return (
    <div className="space-y-3">
      {groups.map((sessions) => {
        const first = sessions[0];
        const latestDone = sessions.find((s) => s.submittedAt) ?? null;
        const validez = computeValidez(latestDone);
        return (
          <section key={first.templateId} className="rounded-card border border-wg-border-lighter bg-white p-3.5">
            <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-record-title text-wg-ink">{first.templateName}</h3>
                <p className="text-meta text-wg-ink-muted">
                  {ASSESSMENT_TYPE_LABEL[first.assessmentType]}
                  {latestDone && validez.valido && (
                    <span className={estaVencendoEm30Dias(validez) ? "text-warning-fg" : undefined}>
                      {" "}
                      · resultado válido até {formatDate(validez.validoAte)}
                    </span>
                  )}
                  {latestDone && !validez.valido && validez.motivo === "expirado" && " · resultado expirado"}
                </p>
              </div>
              {canManage && (
                <Button size="sm" variant="secondary" icon={Send} onClick={() => setInviting(first)}>
                  Reaplicar
                </Button>
              )}
            </header>
            <ul className="divide-y divide-wg-border-lighter">
              {sessions.map((s) => {
                const status = APPLICATION_STATUS[applicationStatus(s, s.assessmentType)];
                const situation = s.submittedAt ? RESULT_SITUATION[resultSituation(s, s.assessmentType)] : null;
                const showScore = s.submittedAt && !isBehavioral(s.assessmentType) && s.score != null && s.outcome !== "PENDING_REVIEW";
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                    <p className="min-w-0 flex-1 text-meta text-wg-ink-secondary">
                      {s.submittedAt ? `Realizado em ${formatDate(s.submittedAt)}` : `Enviado em ${formatDate(s.createdAt)}`}
                      {showScore && <span className="ml-1.5 tabular-nums text-wg-ink">· {Math.round(Number(s.score))}%</span>}
                    </p>
                    {situation && !s.invalidadoEm ? (
                      <StatusBadge tone={situation.tone}>{situation.label}</StatusBadge>
                    ) : (
                      <StatusBadge tone={status.tone} hint={status.hint}>
                        {status.label}
                      </StatusBadge>
                    )}
                    {s.submittedAt && (
                      <Link
                        href={`/avaliacoes/resultados/${s.id}`}
                        className="inline-flex items-center gap-1 text-meta font-semibold text-wg-green-dark hover:underline"
                      >
                        Ver resultado <ExternalLink className="h-3 w-3" aria-hidden />
                      </Link>
                    )}
                    {canManage && s.submittedAt && !s.invalidadoEm && (
                      <Button size="sm" variant="tertiary" icon={Ban} onClick={() => setInvalidating(s)}>
                        Invalidar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {invalidating && (
        <InvalidateDialog talentoId={profile.id} session={invalidating} onClose={() => setInvalidating(null)} onDone={onChanged} />
      )}
      {inviting && <InviteDialog talentoId={profile.id} session={inviting} onClose={() => setInviting(null)} onDone={onChanged} />}
    </div>
  );
}

function InvalidateDialog({
  talentoId,
  session,
  onClose,
  onDone,
}: {
  talentoId: string;
  session: TalentSession;
  onClose: () => void;
  onDone: () => void;
}) {
  const { notify } = useToast();
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (motivo.trim().length < 5) {
      setError("Informe o motivo com ao menos 5 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/talentos/${talentoId}/sessions/${session.id}/invalidate`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      if (!res.ok) {
        setError("Não foi possível invalidar o resultado. Tente novamente.");
        return;
      }
      notify("success", "Resultado invalidado. O histórico foi mantido.");
      onDone();
      onClose();
    } catch {
      setError("Não foi possível invalidar o resultado. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      alert
      onClose={onClose}
      busy={saving}
      title="Invalidar resultado"
      description={`${session.templateName} — o resultado deixa de valer, mas continua no histórico.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={submit} loading={saving}>
            Invalidar resultado
          </Button>
        </>
      }
    >
      <SettingsField id="inv-motivo" label="Motivo" required error={error}>
        <textarea
          id="inv-motivo"
          rows={3}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          placeholder="Ex.: realizado em condições inadequadas."
          className={settingsInputClass}
        />
      </SettingsField>
    </Dialog>
  );
}

function InviteDialog({
  talentoId,
  session,
  onClose,
  onDone,
}: {
  talentoId: string;
  session: TalentSession;
  onClose: () => void;
  onDone: () => void;
}) {
  const { notify } = useToast();
  const [days, setDays] = useState(7);
  const [force, setForce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/talentos/${talentoId}/test-invite`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: session.templateId, expiresInDays: days, forceReinvite: force }),
      });
      const j = (await res.json().catch(() => ({}))) as { testeUrl?: string; error?: unknown };
      if (res.status === 409) {
        setError("O talento já tem um resultado válido deste teste. Marque “Reaplicar mesmo assim” para gerar um novo link.");
        return;
      }
      if (!res.ok || !j.testeUrl) {
        setError("Não foi possível gerar o link. Tente novamente.");
        return;
      }
      setLink(j.testeUrl);
      onDone();
    } catch {
      setError("Não foi possível gerar o link. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={saving}
      title={link ? "Link do teste gerado" : "Reaplicar avaliação"}
      description={session.templateName}
      footer={
        link ? (
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" icon={Send} onClick={submit} loading={saving}>
              Gerar link
            </Button>
          </>
        )
      }
    >
      {link ? (
        <div className="space-y-2">
          <p className="text-body text-wg-ink-secondary">Copie e envie ao candidato — o sistema não envia o link automaticamente.</p>
          <div className="flex gap-2">
            <input readOnly value={link} aria-label="Link do teste" className={settingsInputClass} onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="secondary"
              icon={Copy}
              onClick={() => {
                navigator.clipboard?.writeText(link).then(
                  () => notify("success", "Link copiado."),
                  () => notify("error", "Não foi possível copiar. Selecione o texto e copie manualmente.")
                );
              }}
            >
              Copiar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <SettingsField id="inv-days" label="Validade do link (dias)">
            <input
              id="inv-days"
              type="number"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
              className={settingsInputClass}
            />
          </SettingsField>
          <label className="flex cursor-pointer items-center gap-2 text-body text-wg-ink-secondary">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="h-4 w-4 accent-[#4F6930]" />
            Reaplicar mesmo com resultado válido
          </label>
          {error && (
            <p role="alert" className="text-meta text-danger-fg">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
