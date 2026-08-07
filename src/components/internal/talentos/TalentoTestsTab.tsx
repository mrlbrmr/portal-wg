"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, AlertCircle, Clock, Send, Ban } from "lucide-react";
import type { TesteCard, TesteValidezResult, TesteSessionItem } from "@/lib/talentos/types";
import { estaVencendoEm30Dias } from "@/lib/talentos/validity";

interface Props {
  testes:    TesteCard[];
  talentoId: string;
  isAdmin:   boolean;
}

function ValidezBadge({ validez }: { validez: TesteValidezResult }) {
  if (validez.valido) {
    const warning = estaVencendoEm30Dias(validez);
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
        warning ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
      }`}>
        {warning ? <AlertCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
        Válido · {validez.diasRestantes}d restantes
      </span>
    );
  }
  if (validez.motivo === "nunca_realizado") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
        <Clock className="w-3 h-3" /> Não realizado
      </span>
    );
  }
  if (validez.motivo === "invalidado_pelo_rh") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" /> Invalidado pelo RH
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-orange-700">
      <XCircle className="w-3 h-3" />
      Expirado {validez.expirouEm ? `em ${new Date(validez.expirouEm).toLocaleDateString("pt-BR")}` : ""}
    </span>
  );
}

function InvalidateModal({ sessionId, talentoId, onClose, onDone }: {
  sessionId: string; talentoId: string; onClose: () => void; onDone: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function submit() {
    if (motivo.trim().length < 5) { setError("Informe um motivo com ao menos 5 caracteres."); return; }
    setSaving(true);
    const res = await fetch(`/api/talentos/${talentoId}/sessions/${sessionId}/invalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    setSaving(false);
    if (!res.ok) { setError("Erro ao invalidar. Tente novamente."); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-wg-ink mb-1">Invalidar resultado</h3>
        <p className="text-sm text-wg-ink-muted mb-4">
          Esta ação tornará o resultado inválido. O histórico é mantido. Informe o motivo:
        </p>
        <textarea
          value={motivo}
          onChange={(e) => { setMotivo(e.target.value); setError(""); }}
          rows={3}
          className="w-full rounded-lg border border-wg-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-wg-green/40 resize-none"
          placeholder="Ex: Candidato realizou o teste em condições inadequadas…"
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-wg-border hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? "Invalidando…" : "Confirmar invalidação"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ talentoId, templateId, templateNome, onClose, onDone }: {
  talentoId: string; templateId: string; templateNome: string; onClose: () => void; onDone: () => void;
}) {
  const [days, setDays]           = useState(7);
  const [forceReinvite, setForce] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [link, setLink]           = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/talentos/${talentoId}/test-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, expiresInDays: days, forceReinvite }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      if (res.status === 409) {
        setError("Candidato já possui resultado válido. Marque 'Forçar reaplicação' para enviar mesmo assim.");
        return;
      }
      setError(data?.error ?? "Erro ao gerar convite.");
      return;
    }
    setLink(data.testeUrl);
    onDone();
  }

  if (link) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base font-bold text-wg-ink mb-3">Convite gerado!</h3>
          <p className="text-sm text-wg-ink-muted mb-2">
            Link do teste (<span className="font-medium">copie e envie manualmente ao candidato</span>):
          </p>
          <input
            readOnly
            value={link}
            className="w-full rounded-lg border border-wg-border p-2 text-xs bg-gray-50 select-all"
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-wg-green text-white hover:bg-wg-green-dark"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-wg-ink mb-1">Convidar para teste</h3>
        <p className="text-sm text-wg-ink-muted mb-4">
          Template: <span className="font-medium">{templateNome}</span>
        </p>
        <label className="block text-sm mb-1 font-medium text-wg-ink">Validade do link (dias)</label>
        <input
          type="number"
          min={1}
          max={30}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-full rounded-lg border border-wg-border p-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-wg-green/40"
        />
        <label className="flex items-center gap-2 text-sm text-wg-ink-secondary cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={forceReinvite}
            onChange={(e) => setForce(e.target.checked)}
            className="rounded"
          />
          Forçar reaplicação (mesmo com resultado válido)
        </label>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-wg-border hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-wg-green text-white hover:bg-wg-green-dark disabled:opacity-60"
          >
            {saving ? "Gerando…" : "Gerar convite"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TalentoTestsTab({ testes, talentoId, isAdmin }: Props) {
  const router = useRouter();
  const [invalidating, setInvalidating] = useState<string | null>(null);
  const [inviting, setInviting]         = useState<TesteCard | null>(null);

  function refresh() {
    router.refresh();
    setInvalidating(null);
    setInviting(null);
  }

  if (testes.length === 0) {
    return (
      <div className="py-12 text-center text-wg-ink-muted text-sm">
        Nenhum teste vinculado a este talento ainda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {testes.map((card) => (
        <div key={card.templateId} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold text-wg-ink mb-1">{card.templateNome}</div>
              <div className="flex items-center gap-2 flex-wrap">
                <ValidezBadge validez={card.validez} />
                <span className="text-[11px] text-wg-ink-muted">
                  Validade: {card.validityMonths} {card.validityMonths === 1 ? "mês" : "meses"}
                </span>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => setInviting(card)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-wg-green text-white hover:bg-wg-green-dark transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" /> Convidar
              </button>
            )}
          </div>

          {card.sessoes.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-wg-ink-muted mb-2">
                Histórico de aplicações
              </div>
              {card.sessoes.map((s: TesteSessionItem) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 text-sm rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div>
                    <span className={`font-medium ${s.submittedAt ? "text-wg-ink" : "text-wg-ink-muted"}`}>
                      {s.submittedAt
                        ? `Concluído em ${new Date(s.submittedAt).toLocaleDateString("pt-BR")}`
                        : "Pendente (link enviado)"}
                    </span>
                    {s.score !== null && (
                      <span className="ml-2 text-wg-ink-secondary">· Score: {s.score}</span>
                    )}
                    {s.invalidadoEm && (
                      <span className="ml-2 text-red-600 text-[11px]">
                        · Invalidado em {new Date(s.invalidadoEm).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                  {isAdmin && s.submittedAt && !s.invalidadoEm && (
                    <button
                      onClick={() => setInvalidating(s.id)}
                      className="flex items-center gap-1 text-[11px] text-red-600 hover:text-red-800 transition-colors shrink-0"
                    >
                      <Ban className="w-3.5 h-3.5" /> Invalidar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {invalidating && (
        <InvalidateModal
          sessionId={invalidating}
          talentoId={talentoId}
          onClose={() => setInvalidating(null)}
          onDone={refresh}
        />
      )}
      {inviting && (
        <InviteModal
          talentoId={talentoId}
          templateId={inviting.templateId}
          templateNome={inviting.templateNome}
          onClose={() => setInviting(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}
