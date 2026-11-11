"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, LockKeyhole, ShieldOff } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Panel } from "@/components/ui/Panel";
import { useToast } from "@/components/ui/ToastProvider";
import { anonymizeOnRequestAction, setRetentionHoldAction } from "@/lib/privacy/actions";

export interface TalentPrivacyState {
  anonimizadoEm: string | null;
  retencaoBloqueadaEm: string | null;
  retencaoBloqueioMotivo: string | null;
  retencaoBloqueadaPorNome: string | null;
}

/** Direitos do titular (LGPD) na ficha do talento — só ADMIN_RH. */
export function TalentPrivacyPanel({ talentoId, state }: { talentoId: string; state: TalentPrivacyState }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [holding, setHolding] = useState(false);
  const [motivo, setMotivo] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) return notify("error", r.error ?? "Não foi possível concluir.");
        notify("success", success);
        setHolding(false);
        setMotivo("");
        router.refresh();
      } catch {
        notify("error", "Não foi possível concluir a ação. Tente novamente.");
      }
    });
  }

  if (state.anonimizadoEm) {
    return (
      <Panel title="Privacidade (LGPD)" className="mt-4">
        <p className="text-body text-wg-ink-secondary">
          Os dados pessoais deste cadastro foram anonimizados. Só o histórico do funil permanece, sem identificação.
        </p>
      </Panel>
    );
  }

  const held = Boolean(state.retencaoBloqueadaEm);

  return (
    <Panel
      title="Privacidade (LGPD)"
      description="Direitos do titular e proteção contra anonimização automática."
      className="mt-4"
    >
      {held && (
        <p className="mb-3 flex items-start gap-2 rounded-control bg-warning-bg px-3 py-2 text-body text-warning-fg">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Anonimização bloqueada{state.retencaoBloqueadaPorNome ? ` por ${state.retencaoBloqueadaPorNome}` : ""}
            {state.retencaoBloqueioMotivo ? `: ${state.retencaoBloqueioMotivo}` : "."}
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href={`/api/talentos/${talentoId}/export`} variant="secondary" icon={Download} prefetch={false}>
          Exportar dados do titular
        </ButtonLink>

        {held ? (
          <Button variant="secondary" icon={LockKeyhole} loading={pending} onClick={() => run(() => setRetentionHoldAction(talentoId, null), "Bloqueio removido.")}>
            Remover bloqueio
          </Button>
        ) : (
          <Button variant="secondary" icon={LockKeyhole} onClick={() => setHolding((v) => !v)}>
            Bloquear anonimização
          </Button>
        )}

        <Button variant="danger" icon={ShieldOff} disabled={pending} onClick={() => setConfirm(true)}>
          Anonimizar a pedido do titular
        </Button>
      </div>

      {holding && !held && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[260px] flex-1 text-label text-wg-ink-secondary">
            Motivo jurídico (fica registrado)
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              className="mt-1 block h-10 w-full rounded-control border border-wg-border px-3 text-body"
              placeholder="Ex.: processo trabalhista em andamento"
            />
          </label>
          <Button variant="primary" loading={pending} disabled={motivo.trim().length < 5} onClick={() => run(() => setRetentionHoldAction(talentoId, motivo), "Anonimização bloqueada.")}>
            Confirmar bloqueio
          </Button>
        </div>
      )}

      <ConfirmModal
        isOpen={confirm}
        title="Anonimizar este cadastro agora?"
        message="Nome, contato, CPF, currículo, anotações e respostas de testes serão apagados de forma permanente. Não funciona se houver processo aberto, contratação ou bloqueio."
        confirmLabel="Anonimizar"
        onConfirm={() => {
          setConfirm(false);
          run(() => anonymizeOnRequestAction(talentoId), "Cadastro anonimizado.");
        }}
        onCancel={() => setConfirm(false)}
      />
    </Panel>
  );
}
