"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDate } from "@/lib/utils";
import { MAX_RETENTION_MONTHS, MIN_RETENTION_MONTHS } from "@/lib/privacy/retention";
import { anonymizeTalentsAction, saveRetentionMonthsAction } from "@/lib/privacy/actions";
import type { RetentionRow } from "@/lib/privacy/retention-service";

export function RetentionManager({ months: initialMonths, rows }: { months: number; rows: RetentionRow[] }) {
  const { notify } = useToast();
  const [pending, start] = useTransition();
  const [months, setMonths] = useState(initialMonths);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);

  const eligible = rows.filter((r) => r.eligible);
  const held = rows.filter((r) => r.reason === "BLOQUEIO_JURIDICO");
  const allSelected = eligible.length > 0 && eligible.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function saveMonths() {
    start(async () => {
      const r = await saveRetentionMonthsAction(months);
      if (!r.ok) return notify("error", r.error);
      setMonths(r.months);
      notify("success", "Prazo de retenção salvo.");
    });
  }

  function runAnonymize() {
    setConfirm(false);
    start(async () => {
      const r = await anonymizeTalentsAction([...selected]);
      if (!r.ok) return notify("error", r.error);
      setSelected(new Set());
      if (r.failed > 0) notify("error", `${r.done} anonimizado(s); ${r.failed} falharam — tente novamente.`);
      else notify("success", `${r.done} cadastro(s) anonimizado(s).`);
    });
  }

  return (
    <div className="space-y-6">
      <Panel title="Prazo de retenção" description="Tempo sem nenhuma atividade antes de o cadastro ficar disponível para anonimização.">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-label text-wg-ink-secondary">
            Meses sem atividade
            <input
              type="number"
              min={MIN_RETENTION_MONTHS}
              max={MAX_RETENTION_MONTHS}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="mt-1 block h-10 w-28 rounded-control border border-wg-border px-3 text-body"
            />
          </label>
          <Button variant="primary" onClick={saveMonths} loading={pending} disabled={months === initialMonths}>
            Salvar prazo
          </Button>
          <p className="text-meta text-wg-ink-muted">
            Entre {MIN_RETENTION_MONTHS} e {MAX_RETENTION_MONTHS} meses. Quem tem processo aberto, foi contratado ou está bloqueado nunca entra.
          </p>
        </div>
      </Panel>

      <Panel
        title="Aguardando revisão"
        meta={`${eligible.length} ${eligible.length === 1 ? "cadastro" : "cadastros"}`}
        description="Ao anonimizar: nome, contato, CPF, currículo, anotações e respostas de testes são removidos. Vaga, etapa e datas ficam para as métricas. Não dá para desfazer."
        action={
          <Button variant="danger" icon={ShieldCheck} disabled={selected.size === 0 || pending} onClick={() => setConfirm(true)}>
            Anonimizar selecionados ({selected.size})
          </Button>
        }
      >
        {eligible.length === 0 ? (
          <EmptyState compact icon={ShieldCheck} title="Nenhum cadastro venceu o prazo." description="Quando algum cadastro passar do prazo sem atividade, ele aparece aqui para revisão." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body">
              <thead className="text-label text-wg-ink-muted">
                <tr>
                  <th className="w-10 py-2">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(eligible.map((r) => r.id)))}
                    />
                  </th>
                  <th className="py-2">Pessoa</th>
                  <th className="py-2">Cargo desejado</th>
                  <th className="py-2">Última atividade</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((r) => (
                  <tr key={r.id} className="border-t border-wg-border-lighter">
                    <td className="py-2">
                      <input type="checkbox" aria-label={`Selecionar ${r.nomeCompleto}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    </td>
                    <td className="py-2">
                      <Link href={`/talentos/${r.id}`} className="font-medium text-wg-ink hover:underline">
                        {r.nomeCompleto}
                      </Link>
                      <div className="text-meta text-wg-ink-muted">{r.email}</div>
                    </td>
                    <td className="py-2 text-wg-ink-secondary">{r.cargoDesejado ?? "—"}</td>
                    <td className="py-2 text-wg-ink-secondary">{formatDate(r.lastActivityAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {held.length > 0 && (
        <Panel title="Bloqueados por motivo jurídico" meta={`${held.length}`} description="Não são anonimizados enquanto o bloqueio existir. Remova o bloqueio na ficha do talento.">
          <ul className="space-y-2">
            {held.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-body">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-wg-ink-muted" aria-hidden />
                <span>
                  <Link href={`/talentos/${r.id}`} className="font-medium text-wg-ink hover:underline">
                    {r.nomeCompleto}
                  </Link>
                  {r.retencaoBloqueioMotivo && <span className="text-wg-ink-muted"> — {r.retencaoBloqueioMotivo}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <ConfirmModal
        isOpen={confirm}
        title="Anonimizar cadastros selecionados?"
        message={`${selected.size} cadastro(s) terão dados pessoais e arquivos apagados de forma permanente. O servidor confere de novo cada um antes de agir.`}
        confirmLabel="Anonimizar"
        onConfirm={runAnonymize}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
