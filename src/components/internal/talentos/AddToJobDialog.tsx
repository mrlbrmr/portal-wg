"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { SettingsField, settingsSelectClass } from "@/components/internal/settings/fields";
import { addTalentsToJobAction, type BulkTarget } from "@/lib/talentos/actions";
import type { AddToJobOutcome } from "@/lib/talentos/service";

interface JobOption {
  id: string;
  title: string;
  code: string | null;
  location: string | null;
  statusLabel: string;
  stages: Array<{ id: string; name: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  target: BulkTarget;
  /** "Emerson Fernandes Santos" ou "3 talentos". */
  subject: string;
  count: number;
  onDone?: () => void;
}

const candidateHref = (jobId: string, applicationId: string) => `/vagas/${jobId}/candidatos?candidato=${applicationId}`;

/**
 * Adiciona talento(s) a um processo seletivo: cria a candidatura ligada ao MESMO perfil
 * (sem duplicar o talento), com origem "Banco de Talentos". Quem já participa da vaga não
 * ganha outra candidatura — o diálogo avisa e oferece abrir a existente.
 */
export function AddToJobDialog({ open, onClose, target, subject, count, onDone }: Props) {
  const { notify } = useToast();
  const [jobs, setJobs] = useState<JobOption[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [jobId, setJobId] = useState("");
  const [stageId, setStageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ jobId: string; jobTitle: string; outcomes: AddToJobOutcome[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    if (jobs) return;
    let cancelled = false;
    setLoadError(false);
    fetch("/api/talentos/vagas-disponiveis", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { jobs: JobOption[] }) => {
        if (!cancelled) setJobs(j.jobs);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, jobs, attempt]);

  const job = jobs?.find((j) => j.id === jobId) ?? null;

  // Etapa inicial padrão: "Novas candidaturas" (ou a primeira etapa de entrada do funil).
  useEffect(() => {
    if (!job) return;
    setStageId((cur) => (job.stages.some((s) => s.id === cur) ? cur : (job.stages.find((s) => s.id === "NEW") ?? job.stages[0])?.id ?? ""));
  }, [job]);

  const submit = async () => {
    if (!job || !stageId) return;
    setSaving(true);
    setError(null);
    try {
      const r = await addTalentsToJobAction({ target, jobId: job.id, stageId });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const added = r.outcomes.filter((o) => o.status === "added").length;
      const allAdded = added === r.outcomes.length;
      if (allAdded) {
        notify("success", added === 1 ? "Talento adicionado à vaga." : `${added} talentos adicionados à vaga.`);
        onDone?.();
        onClose();
        return;
      }
      if (added > 0) onDone?.();
      setResult(r);
    } catch {
      setError("Não foi possível adicionar o talento à vaga. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const single = count === 1;

  if (result) {
    const added = result.outcomes.filter((o) => o.status === "added");
    const dups = result.outcomes.filter((o) => o.status === "duplicate");
    const errors = result.outcomes.filter((o) => o.status === "error");
    const onlyDup = single && dups.length === 1;
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={onlyDup ? "Talento já participa da vaga" : "Resultado"}
        description={result.jobTitle}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
            {onlyDup ? (
              <ButtonLink variant="primary" icon={ExternalLink} href={candidateHref(result.jobId, dups[0].applicationId)}>
                Abrir candidatura
              </ButtonLink>
            ) : (
              <ButtonLink variant="primary" icon={ExternalLink} href={`/vagas/${result.jobId}/candidatos`}>
                Ver candidatos da vaga
              </ButtonLink>
            )}
          </>
        }
      >
        {onlyDup ? (
          <p className="text-body text-wg-ink">Este talento já participa deste processo seletivo. Nenhuma candidatura nova foi criada.</p>
        ) : (
          <div className="space-y-3 text-body">
            {added.length > 0 && (
              <p className="flex items-center gap-2 text-success-fg">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {added.length === 1 ? "1 talento adicionado" : `${added.length} talentos adicionados`}
              </p>
            )}
            {dups.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-wg-ink">Já participavam deste processo ({dups.length}):</p>
                <ul className="space-y-1">
                  {dups.map((d) => (
                    <li key={d.talentoId} className="flex items-center justify-between gap-2 text-meta">
                      <span className="truncate text-wg-ink-secondary">{d.nome}</span>
                      <a href={candidateHref(result.jobId, d.applicationId)} className="shrink-0 font-semibold text-wg-green-dark hover:underline">
                        Abrir candidatura
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {errors.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 font-medium text-danger-fg">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Não adicionados ({errors.length}):
                </p>
                <ul className="space-y-1 text-meta text-wg-ink-secondary">
                  {errors.map((e) => (
                    <li key={e.talentoId}>
                      {e.nome} — {e.status === "error" ? e.message : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={saving}
      title={`Adicionar ${subject} a uma vaga`}
      description="Cria a candidatura no processo seletivo usando o mesmo perfil — o talento não é duplicado."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" icon={BriefcaseBusiness} onClick={submit} loading={saving} disabled={!job || !stageId}>
            Adicionar à vaga
          </Button>
        </>
      }
    >
      {loadError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-body text-danger-fg">
          Não foi possível carregar as vagas.
          <Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : !jobs ? (
        <div className="space-y-4" aria-busy="true" aria-label="Carregando vagas">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : jobs.length === 0 ? (
        <p className="text-body text-wg-ink-muted">Nenhuma vaga em andamento no momento. Abra uma vaga para adicionar talentos a ela.</p>
      ) : (
        <div className="space-y-4">
          <SettingsField id="atj-job" label="Vaga" hint="Somente vagas em andamento (não encerradas, pausadas ou canceladas).">
            <select
              id="atj-job"
              value={jobId}
              onChange={(e) => {
                setJobId(e.target.value);
                setError(null);
              }}
              className={settingsSelectClass}
            >
              <option value="">Selecione a vaga</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                  {j.location ? ` — ${j.location}` : ""}
                  {j.code ? ` (${j.code})` : ""}
                  {j.statusLabel !== "Ativa" ? ` · ${j.statusLabel}` : ""}
                </option>
              ))}
            </select>
          </SettingsField>
          <SettingsField id="atj-stage" label="Etapa inicial" hint="Admissão, contratação e reprovação seguem as regras do pipeline da vaga.">
            <select id="atj-stage" value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={!job} className={settingsSelectClass}>
              {!job && <option value="">Escolha a vaga primeiro</option>}
              {job?.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </SettingsField>
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
