"use client";

import { useId, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  BriefcaseBusiness,
  CircleSlash,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  X,
} from "lucide-react";
import { Button, ButtonLink, buttonVariants } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { StageBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { cn, formatDate } from "@/lib/utils";
import {
  EDITABLE_STATUS_LABELS,
  SITUATION_META,
  fullDateTime,
  locationLabel,
  originLabel,
  relativeDay,
} from "@/lib/talentos/crm";
import {
  addTagsToTalents,
  archiveTalentsAction,
  changeTalentStatus,
  favoriteTalents,
  removeTagsFromTalents,
  restoreTalentsAction,
} from "@/lib/talentos/actions";
import type { TalentProfileData } from "@/lib/talentos/profile";
import type { TagItem } from "@/lib/talentos/service";
import { AddToJobDialog } from "./AddToJobDialog";
import { EditTalentDialog } from "./EditTalentDialog";
import { TagPicker } from "./TagPicker";
import { TalentAssessmentsPanel } from "./TalentAssessmentsPanel";
import { TalentHistoryPanel, candidateHref } from "./TalentHistoryPanel";
import { TalentNotesPanel } from "./TalentNotesPanel";
import { FavoriteToggle, Missing, SituationBadge, TagChip, TalentAvatar } from "./talent-ui";

export type TalentTab = "resumo" | "historico" | "avaliacoes" | "anotacoes" | "arquivos";

interface Props {
  profile: TalentProfileData;
  canManage: boolean;
  currentUserId: string;
  variant: "drawer" | "page";
  tags: TagItem[];
  onCreateTag: (name: string) => Promise<TagItem | null>;
  /** Recarrega o perfil (sem piscar) depois de uma ação. */
  onRefresh: () => void;
  /** Abre outro talento (ex.: perfil existente apontado pela checagem de duplicidade). */
  onOpenTalent?: (id: string) => void;
  initialTab?: TalentTab;
  initialDialog?: "edit" | null;
  /** Id do título, para o aria-labelledby do drawer. */
  titleId?: string;
  /** Botão de fechar (drawer). */
  closeButton?: ReactNode;
}

/**
 * Perfil do talento: MESMO conteúdo no drawer (consulta rápida) e na página completa.
 * Cabeçalho (quem é + ações) e abas — só as que têm conteúdo ou ação real.
 */
export function TalentWorkspace({
  profile,
  canManage,
  currentUserId,
  variant,
  tags,
  onCreateTag,
  onRefresh,
  onOpenTalent,
  initialTab = "resumo",
  initialDialog = null,
  titleId,
  closeButton,
}: Props) {
  const { notify } = useToast();
  const tabsId = useId();
  const [tab, setTab] = useState<TalentTab>(initialTab);
  const [favorite, setFavorite] = useState(profile.favorito);
  const [favBusy, setFavBusy] = useState(false);
  const [dialog, setDialog] = useState<"job" | "edit" | "archive" | null>(canManage ? initialDialog : null);
  const [busy, setBusy] = useState(false);

  // Favorito otimista: volta ao valor do servidor quando o perfil recarrega.
  const [syncedFav, setSyncedFav] = useState(profile.favorito);
  if (syncedFav !== profile.favorito) {
    setSyncedFav(profile.favorito);
    setFavorite(profile.favorito);
  }

  const archived = profile.situacao === "ARQUIVADO";
  const files = useMemo(
    () => profile.applications.filter((a) => a.hasResume && !a.resumeIsProfileCv),
    [profile.applications]
  );
  const fileCount = files.length + (profile.hasCurriculo ? 1 : 0);
  const openApps = profile.applications.filter((a) => a.isOpen);

  const tabs: Array<{ id: TalentTab; label: string; count?: number }> = [
    { id: "resumo", label: "Resumo" },
    { id: "historico", label: "Histórico", count: profile.applications.length },
    ...(profile.sessions.length > 0 ? [{ id: "avaliacoes" as const, label: "Avaliações", count: profile.sessions.filter((s) => s.submittedAt).length }] : []),
    { id: "anotacoes", label: "Anotações", count: profile.notes.length },
    ...(fileCount > 0 ? [{ id: "arquivos" as const, label: "Arquivos", count: fileCount }] : []),
  ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "resumo";
  const tabRefs = useRef(new Map<TalentTab, HTMLButtonElement>());

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) => {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) notify("error", r.error);
      else {
        notify("success", success);
        onRefresh();
      }
    } catch {
      notify("error", "Não foi possível concluir a ação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = async () => {
    const next = !favorite;
    setFavorite(next);
    setFavBusy(true);
    try {
      const r = await favoriteTalents({ ids: [profile.id] }, next);
      if (!r.ok) {
        setFavorite(!next);
        notify("error", r.error);
      } else {
        onRefresh();
      }
    } catch {
      setFavorite(!next);
      notify("error", "Não foi possível atualizar o favorito.");
    } finally {
      setFavBusy(false);
    }
  };

  const manualStatus = profile.statusBanco === "INDISPONIVEL" || profile.statusBanco === "NAO_ADERENTE" ? "INDISPONIVEL" : "ATIVO";

  const menuItems: DropdownMenuItem[] = [
    ...(canManage ? [{ label: "Editar dados", icon: Pencil, onSelect: () => setDialog("edit") } as DropdownMenuItem] : []),
    ...(profile.hasCurriculo
      ? [{ label: "Baixar currículo", icon: Download, href: `/api/talentos/${profile.id}/resume?download=1` } as DropdownMenuItem]
      : []),
    ...(canManage && !archived
      ? [
          { type: "separator" } as DropdownMenuItem,
          manualStatus === "ATIVO"
            ? ({
                label: "Marcar como indisponível",
                icon: CircleSlash,
                onSelect: () => run(() => changeTalentStatus({ ids: [profile.id] }, "INDISPONIVEL"), "Talento marcado como indisponível."),
              } as DropdownMenuItem)
            : ({
                label: "Marcar como disponível",
                icon: CheckCircle2,
                onSelect: () => run(() => changeTalentStatus({ ids: [profile.id] }, "ATIVO"), "Talento marcado como disponível."),
              } as DropdownMenuItem),
          { label: "Arquivar", icon: Archive, danger: true, onSelect: () => setDialog("archive") } as DropdownMenuItem,
        ]
      : []),
    ...(canManage && archived
      ? [
          { type: "separator" } as DropdownMenuItem,
          {
            label: "Restaurar do arquivo",
            icon: ArchiveRestore,
            onSelect: () => run(() => restoreTalentsAction({ ids: [profile.id] }), "Talento restaurado."),
          } as DropdownMenuItem,
        ]
      : []),
  ];

  const location = locationLabel(profile.cidade, profile.estado);

  return (
    <div className={cn("flex min-h-0 flex-col", variant === "drawer" && "h-full")}>
      {/* ── Cabeçalho ── */}
      <header className={cn("border-b border-wg-border-lighter bg-white", variant === "drawer" ? "px-5 pb-3 pt-4" : "rounded-t-card px-5 pb-3 pt-5")}>
        <div className="flex items-start gap-3">
          <TalentAvatar name={profile.nomeCompleto} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {variant === "page" ? (
                <h1 id={titleId} className="font-sora text-xl font-semibold tracking-tight text-wg-ink md:text-2xl">
                  {profile.nomeCompleto}
                </h1>
              ) : (
                <h2 id={titleId} className="font-sora text-lg font-semibold text-wg-ink">
                  {profile.nomeCompleto}
                </h2>
              )}
              <FavoriteToggle
                name={profile.nomeCompleto}
                active={favorite}
                onToggle={canManage ? toggleFavorite : undefined}
                disabled={favBusy}
                size="md"
              />
              <SituationBadge situation={profile.situacao} />
            </div>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-meta text-wg-ink-secondary">
              <li className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
                {location ?? <Missing>Localização não informada</Missing>}
              </li>
              <li className="flex min-w-0 items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0 text-wg-ink-muted" aria-hidden />
                <a href={`mailto:${profile.email}`} className="truncate hover:text-wg-ink hover:underline">
                  {profile.email}
                </a>
              </li>
              <li className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
                {profile.telefone ? (
                  <a href={`tel:${profile.telefone.replace(/\D/g, "")}`} className="hover:text-wg-ink hover:underline">
                    {profile.telefone}
                  </a>
                ) : (
                  <Missing>Telefone não informado</Missing>
                )}
              </li>
            </ul>
          </div>
          {closeButton}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canManage && !archived && (
            <Button variant="primary" size="sm" icon={BriefcaseBusiness} onClick={() => setDialog("job")}>
              Adicionar à vaga
            </Button>
          )}
          {canManage && archived && (
            <Button
              variant="primary"
              size="sm"
              icon={ArchiveRestore}
              loading={busy}
              onClick={() => run(() => restoreTalentsAction({ ids: [profile.id] }), "Talento restaurado.")}
            >
              Restaurar
            </Button>
          )}
          {variant === "drawer" && (
            <ButtonLink variant="secondary" size="sm" icon={ExternalLink} href={`/talentos/${profile.id}`}>
              Abrir perfil completo
            </ButtonLink>
          )}
          {menuItems.length > 0 && (
            <DropdownMenu
              portal
              ariaLabel="Mais ações do talento"
              title="Mais ações"
              trigger={<MoreHorizontal aria-hidden />}
              triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
              items={menuItems}
              align="left"
            />
          )}
        </div>

        {/* ── Abas ── */}
        <div
          role="tablist"
          aria-label="Seções do perfil"
          className="-mb-3 mt-3 flex gap-1 overflow-x-auto"
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const i = tabs.findIndex((t) => t.id === activeTab);
            const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
            setTab(next.id);
            tabRefs.current.get(next.id)?.focus();
          }}
        >
          {tabs.map((t) => {
            const selected = t.id === activeTab;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(t.id, el);
                }}
                role="tab"
                type="button"
                id={`${tabsId}-${t.id}`}
                aria-selected={selected}
                aria-controls={`${tabsId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
                  selected ? "border-wg-green-dark text-wg-ink" : "border-transparent text-wg-ink-muted hover:text-wg-ink"
                )}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", selected ? "bg-wg-sidebar text-wg-green-dark" : "bg-neutral-bg text-neutral-fg")}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Conteúdo ── */}
      <div
        id={`${tabsId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${activeTab}`}
        tabIndex={0}
        className={cn("min-h-0 flex-1 bg-wg-bg px-5 py-4 focus-visible:outline-none", variant === "drawer" && "overflow-y-auto")}
      >
        {activeTab === "resumo" && (
          <SummaryPanel
            profile={profile}
            openApps={openApps}
            canManage={canManage}
            tags={tags}
            onCreateTag={onCreateTag}
            onRefresh={onRefresh}
            manualStatus={manualStatus}
          />
        )}
        {activeTab === "historico" && <TalentHistoryPanel profile={profile} />}
        {activeTab === "avaliacoes" && <TalentAssessmentsPanel profile={profile} canManage={canManage} onChanged={onRefresh} />}
        {activeTab === "anotacoes" && (
          <TalentNotesPanel
            talentoId={profile.id}
            notes={profile.notes}
            canManage={canManage}
            currentUserId={currentUserId}
            onChanged={onRefresh}
          />
        )}
        {activeTab === "arquivos" && <FilesPanel profile={profile} files={files} />}
      </div>

      {canManage && (
        <>
          <AddToJobDialog
            open={dialog === "job"}
            onClose={() => setDialog(null)}
            target={{ ids: [profile.id] }}
            subject={profile.nomeCompleto}
            count={1}
            onDone={onRefresh}
          />
          <EditTalentDialog
            open={dialog === "edit"}
            onClose={() => setDialog(null)}
            profile={profile}
            onSaved={onRefresh}
            onOpenTalent={onOpenTalent}
          />
          <ConfirmModal
            isOpen={dialog === "archive"}
            variant="warning"
            title="Arquivar talento?"
            message={
              openApps.length > 0
                ? `${profile.nomeCompleto} participa de ${openApps.length === 1 ? "um processo em andamento" : `${openApps.length} processos em andamento`}. Arquivar só o tira da lista padrão do banco — as candidaturas continuam. Você pode restaurá-lo depois.`
                : `${profile.nomeCompleto} sai da lista padrão, mas o histórico é mantido e pode ser restaurado a qualquer momento.`
            }
            confirmLabel="Arquivar"
            onCancel={() => setDialog(null)}
            onConfirm={() => {
              setDialog(null);
              void run(() => archiveTalentsAction({ ids: [profile.id] }), "Talento arquivado.");
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── Resumo ────────────────────────────────────────────────────────────────────────

function Field({ label, icon: Icon, children }: { label: string; icon?: ElementType; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-0.5 flex items-center gap-1 text-label text-wg-ink-muted">
        {Icon && <Icon className="h-3 w-3" aria-hidden />}
        {label}
      </dt>
      <dd className="min-w-0 break-words text-body text-wg-ink">{children}</dd>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-card border border-wg-border-lighter bg-white p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="font-inter text-label uppercase tracking-wide text-wg-ink-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SummaryPanel({
  profile,
  openApps,
  canManage,
  tags,
  onCreateTag,
  onRefresh,
  manualStatus,
}: {
  profile: TalentProfileData;
  openApps: TalentProfileData["applications"];
  canManage: boolean;
  tags: TagItem[];
  onCreateTag: (name: string) => Promise<TagItem | null>;
  onRefresh: () => void;
  manualStatus: "ATIVO" | "INDISPONIVEL";
}) {
  const { notify } = useToast();
  const [picking, setPicking] = useState(false);
  const [current, setCurrent] = useState(profile.tags);
  const [synced, setSynced] = useState(profile.tags);
  if (synced !== profile.tags) {
    setSynced(profile.tags);
    setCurrent(profile.tags);
  }

  // Tags: aplicadas na hora (otimista), com volta atrás em caso de erro.
  const toggleTag = async (tag: TagItem) => {
    const has = current.some((t) => t.id === tag.id);
    const before = current;
    setCurrent(has ? current.filter((t) => t.id !== tag.id) : [...current, tag].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    try {
      const r = has ? await removeTagsFromTalents({ ids: [profile.id] }, [tag.id]) : await addTagsToTalents({ ids: [profile.id] }, [tag.id]);
      if (!r.ok) {
        setCurrent(before);
        notify("error", r.error);
        return;
      }
      onRefresh();
    } catch {
      setCurrent(before);
      notify("error", "Não foi possível atualizar as tags.");
    }
  };

  const area = profile.areaInteresse ?? profile.applications.find((a) => a.jobArea)?.jobArea ?? null;
  const meta = SITUATION_META[profile.situacao];

  return (
    <div className="space-y-3">
      {openApps.length > 0 && (
        <Card title={`Processos atuais (${openApps.length})`}>
          <ul className="space-y-2">
            {openApps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 truncate text-body font-medium text-wg-ink">{a.jobTitle}</span>
                <StageBadge color={a.stageColor ?? undefined} hint="Etapa da candidatura nesta vaga">
                  {a.stageName}
                </StageBadge>
                <Link href={candidateHref(a.jobId, a.id)} className="text-meta font-semibold text-wg-green-dark hover:underline">
                  Abrir candidatura
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Perfil">
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Cargo de interesse">{profile.cargoDesejado ?? <Missing>Não informado</Missing>}</Field>
          <Field label="Área">
            {area ?? <Missing>Não informada</Missing>}
            {!profile.areaInteresse && area && <span className="ml-1 text-meta text-wg-ink-muted">(das vagas)</span>}
          </Field>
          {profile.ultimoCargoCv && <Field label="Último cargo (currículo)">{profile.ultimoCargoCv}</Field>}
          {profile.pretensaoSalarial != null && (
            <Field label="Pretensão salarial">
              {profile.pretensaoSalarial.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
            </Field>
          )}
          <Field label="Situação no banco">
            <span title={meta.hint}>{meta.label}</span>
            <span className="ml-1 text-meta text-wg-ink-muted">{meta.calculated ? "(pelas candidaturas)" : ""}</span>
          </Field>
          <Field label="Disponibilidade (definida pelo RH)">{EDITABLE_STATUS_LABELS[manualStatus]}</Field>
          <Field label="Origem">{originLabel(profile.origemDetalhe ?? profile.origem)}</Field>
          <Field label="No banco desde">{formatDate(profile.createdAt)}</Field>
          <Field label="Última atividade">
            <span title={fullDateTime(profile.ultimaAtividadeEm)}>{relativeDay(profile.ultimaAtividadeEm)}</span>
          </Field>
          {profile.linkedinUrl && (
            <Field label="LinkedIn">
              <a
                href={profile.linkedinUrl.startsWith("http") ? profile.linkedinUrl : `https://${profile.linkedinUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-wg-green-dark hover:underline"
              >
                Abrir perfil
              </a>
            </Field>
          )}
          {profile.cpfMascarado && <Field label="CPF">{profile.cpfMascarado}</Field>}
          <Field label="Consentimento LGPD">
            {profile.consentimentoLgpdEm ? `Em ${formatDate(profile.consentimentoLgpdEm)}` : <Missing>Sem registro no portal</Missing>}
          </Field>
        </dl>
      </Card>

      <Card
        title="Tags"
        action={
          canManage && (
            <Button size="sm" variant="tertiary" icon={picking ? X : Plus} onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
              {picking ? "Fechar" : "Adicionar tag"}
            </Button>
          )
        }
      >
        {current.length === 0 && !picking ? (
          <Missing>Nenhuma tag</Missing>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {current.map((t) => (
              <TagChip key={t.id} name={t.name} color={t.color} onRemove={canManage ? () => toggleTag(t) : undefined} />
            ))}
          </div>
        )}
        {picking && (
          <div className="mt-3">
            <TagPicker
              autoFocus
              tags={tags}
              selectedIds={current.map((t) => t.id)}
              onToggle={toggleTag}
              onCreate={async (name) => {
                const tag = await onCreateTag(name);
                if (tag && !current.some((t) => t.id === tag.id)) await toggleTag(tag);
                return tag;
              }}
            />
          </div>
        )}
      </Card>

      {(profile.habilidadesCv.length > 0 || profile.resumoProfissional) && (
        <Card title="Sobre">
          {profile.resumoProfissional && <p className="whitespace-pre-wrap text-body text-wg-ink-secondary">{profile.resumoProfissional}</p>}
          {profile.habilidadesCv.length > 0 && (
            <div className={profile.resumoProfissional ? "mt-3" : undefined}>
              <p className="mb-1.5 text-label text-wg-ink-muted">Habilidades citadas no currículo</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.habilidadesCv.map((s) => (
                  <span key={s} className="rounded-full bg-neutral-bg px-2 py-0.5 text-[11.5px] text-neutral-fg">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Arquivos ───────────────────────────────────────────────────────────────────────

function FilesPanel({ profile, files }: { profile: TalentProfileData; files: TalentProfileData["applications"] }) {
  const rows: Array<{ key: string; name: string; detail: string; view: string; download: string }> = [
    ...(profile.hasCurriculo
      ? [
          {
            key: "profile",
            name: profile.curriculoNome ?? "Currículo",
            detail: "Currículo do perfil",
            view: `/api/talentos/${profile.id}/resume`,
            download: `/api/talentos/${profile.id}/resume?download=1`,
          },
        ]
      : []),
    ...files.map((a) => ({
      key: a.id,
      name: a.resumeName ?? "Currículo",
      detail: `Enviado na candidatura ${a.jobTitle} · ${formatDate(a.createdAt)}`,
      view: `/api/applications/${a.id}/resume`,
      download: `/api/applications/${a.id}/resume?download=1`,
    })),
  ];

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-wg-border-lighter rounded-card border border-wg-border-lighter bg-white">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
            <FileText className="h-4 w-4 shrink-0 text-wg-ink-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium text-wg-ink">{r.name}</p>
              <p className="text-meta text-wg-ink-muted">{r.detail}</p>
            </div>
            <a href={r.view} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <ExternalLink aria-hidden />
              Abrir
            </a>
            <a href={r.download} className={buttonVariants({ variant: "tertiary", size: "icon-sm" })} aria-label={`Baixar ${r.name}`} title="Baixar">
              <Download aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] text-wg-ink-muted">
        Só arquivos do recrutamento. Documentos admissionais ficam no módulo de Admissões.
      </p>
    </div>
  );
}
