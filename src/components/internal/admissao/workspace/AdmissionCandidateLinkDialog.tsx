"use client";

// "Vincular ao processo seletivo" — liga a admissão à candidatura da mesma pessoa.
// Sugestões pelo CPF/e-mail/nome da admissão; busca livre por nome, e-mail ou CPF.
// Ao vincular: a admissão aponta a candidatura (unifica os cadastros), dados vazios são
// completados, o candidato pode ir para a etapa de Admissão e ocupar uma posição da vaga.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Search } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { StageBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import {
  MATCH_REASON_LABELS,
  suggestedHiringStage,
  type LinkStage,
  type PositionPlan,
} from "@/lib/admissao/candidate-link";
import {
  getLinkPositionPlan,
  linkAdmissionCandidate,
  searchLinkCandidates,
  type LinkCandidate,
} from "@/lib/admissao/candidate-link-actions";
import { positionLabel } from "@/lib/jobs/positions";

interface Props {
  open: boolean;
  admissionId: string;
  admissionName: string;
  onClose: () => void;
}

const selectClass =
  "h-9 w-full rounded-control border border-wg-border-light bg-white px-2 text-body text-wg-ink focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30";

export function AdmissionCandidateLinkDialog({ open, admissionId, admissionName, onClose }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<LinkCandidate[]>([]);
  const [stages, setStages] = useState<LinkStage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveStage, setMoveStage] = useState(true);
  const [stageId, setStageId] = useState("");
  const [plan, setPlan] = useState<PositionPlan | null>(null);
  const [positionId, setPositionId] = useState("");
  const [saving, setSaving] = useState(false);
  const requestRef = useRef(0);

  // Reabrir começa do zero (sugestões da admissão).
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedId(null);
    setError(null);
  }, [open]);

  // Busca com espera curta; só a resposta mais recente vale.
  useEffect(() => {
    if (!open) return;
    const id = ++requestRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchLinkCandidates(admissionId, query).catch(() => null);
      if (id !== requestRef.current) return;
      setLoading(false);
      if (!r || !r.ok) {
        setError(r && !r.ok ? r.error : "Não foi possível buscar os candidatos.");
        setCandidates([]);
        return;
      }
      setError(null);
      setCandidates(r.candidates);
      setStages(r.stages);
    }, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, query, admissionId]);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const suggestedStage = selected ? suggestedHiringStage(selected.stageKind, stages) : null;

  // Ao escolher: etapa sugerida e posições da vaga dessa candidatura.
  useEffect(() => {
    if (!selectedId) {
      setPlan(null);
      return;
    }
    const c = candidates.find((x) => x.id === selectedId);
    setStageId((c && suggestedHiringStage(c.stageKind, stages)) ?? "");
    setMoveStage(true);
    setPlan(null);
    setPositionId("");
    let alive = true;
    getLinkPositionPlan(admissionId, selectedId)
      .then((r) => {
        if (!alive) return;
        const p: PositionPlan = r.ok ? r.plan : { kind: "none" };
        setPlan(p);
        setPositionId(p.kind === "open" ? p.options[0].id : "");
      })
      .catch(() => alive && setPlan({ kind: "none" }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, admissionId]);

  const submit = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const r = await linkAdmissionCandidate(admissionId, {
        applicationId: selected.id,
        stageId: suggestedStage && moveStage && stageId ? stageId : null,
        positionId: plan?.kind === "open" && positionId ? positionId : null,
      });
      if (!r.ok) {
        notify("error", r.error);
        return;
      }
      notify(
        "success",
        r.filled.length
          ? `Admissão vinculada a ${selected.fullName}. Completados: ${r.filled.join(", ")}.`
          : `Admissão vinculada a ${selected.fullName}.`
      );
      if (r.warning) notify("error", r.warning);
      onClose();
      router.refresh();
    } catch {
      notify("error", "Não foi possível vincular. Verifique a conexão e tente novamente.");
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
      title="Vincular ao processo seletivo"
      description={
        <>
          Escolha a candidatura de <strong className="font-semibold text-wg-ink">{admissionName}</strong>. Admissão e candidato
          passam a ser o mesmo cadastro: o pipeline mostra a admissão e o Banco de Talentos o conta como contratado.
        </>
      }
      initialFocus="#link-candidate-search"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!selected}>
            Vincular
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wg-ink-muted/70" aria-hidden />
          <input
            id="link-candidate-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedId(null);
            }}
            placeholder="Buscar por nome, e-mail ou CPF"
            aria-label="Buscar candidato por nome, e-mail ou CPF"
            className="h-9 w-full rounded-control border border-wg-border-light bg-white pl-9 pr-3 text-body text-wg-ink placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30"
          />
        </div>

        <div>
          <p className="mb-2 text-label uppercase tracking-wide text-wg-ink-muted" aria-live="polite">
            {loading
              ? "Buscando…"
              : query
                ? `${candidates.length} ${candidates.length === 1 ? "candidatura encontrada" : "candidaturas encontradas"}`
                : "Sugestões pelo CPF, e-mail e nome da admissão"}
          </p>
          {error ? (
            <p className="flex items-center gap-1.5 text-body text-danger-fg">
              <AlertCircle className="h-4 w-4" aria-hidden /> {error}
            </p>
          ) : !loading && candidates.length === 0 ? (
            <p className="rounded-control border border-dashed border-wg-border-light px-3 py-4 text-center text-body text-wg-ink-muted">
              {query
                ? "Nenhuma candidatura com esse nome, e-mail ou CPF."
                : "Nenhuma candidatura com o mesmo CPF, e-mail ou nome. Busque acima pelo nome usado no processo seletivo."}
            </p>
          ) : (
            <ul role="radiogroup" aria-label="Candidaturas" className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto pr-1">
              {candidates.map((c) => {
                const isSel = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      disabled={!!c.blocker}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-control border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/40",
                        isSel ? "border-wg-green-dark bg-wg-green/10 ring-1 ring-wg-green-dark/30" : "border-wg-border-lighter hover:bg-wg-hover-light",
                        c.blocker && "cursor-not-allowed opacity-60 hover:bg-transparent"
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-body font-semibold text-wg-ink">{c.fullName}</span>
                        {c.reasons.map((r) => (
                          <StatusBadge key={r} tone={r === "CPF" || r === "EMAIL" ? "success" : "info"}>
                            {MATCH_REASON_LABELS[r]}
                          </StatusBadge>
                        ))}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-wg-ink-muted">
                        <span className="truncate">{c.jobLabel}</span>
                        {c.jobClosed && <span>(vaga encerrada)</span>}
                        {c.stageName && <StageBadge color={c.stageColor ?? undefined}>{c.stageName}</StageBadge>}
                      </span>
                      <span className="text-meta text-wg-ink-muted">
                        {[c.email, c.cpfMasked && `CPF ${c.cpfMasked}`, `Candidatura de ${new Date(c.createdAt).toLocaleDateString("pt-BR")}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {c.blocker && <span className="text-meta font-medium text-warning-fg">{c.blocker}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected && (
          <section aria-label="Ao vincular" className="flex flex-col gap-3 rounded-control border border-wg-border-lighter bg-wg-hover-light/40 p-3">
            <h3 className="text-label uppercase tracking-wide text-wg-ink-muted">Ao vincular</h3>

            {suggestedStage ? (
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-body text-wg-ink">
                  <input type="checkbox" checked={moveStage} onChange={(e) => setMoveStage(e.target.checked)} className="h-4 w-4 accent-wg-green-dark" />
                  Mover o candidato no funil{selected.stageName ? ` (hoje em “${selected.stageName}”)` : ""}
                </label>
                {moveStage && stages.length > 1 && (
                  <select aria-label="Etapa de destino" value={stageId} onChange={(e) => setStageId(e.target.value)} className={cn(selectClass, "sm:max-w-xs")}>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
                {moveStage && stages.length === 1 && <p className="text-meta text-wg-ink-muted">Vai para “{stages[0].name}”.</p>}
              </div>
            ) : (
              <p className="text-body text-wg-ink-secondary">
                {selected.stageName ? `O candidato já está em “${selected.stageName}” — a etapa não muda.` : "A etapa do candidato não muda."}
              </p>
            )}

            {plan === null ? (
              <p className="text-meta text-wg-ink-muted">Verificando as posições da vaga…</p>
            ) : plan.kind === "occupied" ? (
              <p className="text-body text-wg-ink-secondary">
                {plan.hasOtherAdmission
                  ? `O candidato ocupa a posição ${positionLabel(plan.positionNumber)}, que já aponta para outra admissão.`
                  : `O candidato já ocupa a posição ${positionLabel(plan.positionNumber)} — a admissão fica ligada a ela.`}
              </p>
            ) : plan.kind === "open" ? (
              <label className="flex flex-col gap-1.5 text-body text-wg-ink">
                Posição da vaga
                <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={cn(selectClass, "sm:max-w-xs")}>
                  {plan.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      Ocupar a posição {positionLabel(o.positionNumber)}
                    </option>
                  ))}
                  <option value="">Não ocupar posição agora</option>
                </select>
              </label>
            ) : null}

            <p className="text-meta text-wg-ink-muted">
              CPF, e-mail e telefone vazios na admissão são completados com os da candidatura. O que já está preenchido não muda.
            </p>
          </section>
        )}
      </div>
    </Dialog>
  );
}
