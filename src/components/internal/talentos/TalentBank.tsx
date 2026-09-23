"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Bookmark,
  BookmarkPlus,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Download,
  ExternalLink,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SearchX,
  Star,
  StarOff,
  Tag,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { CompactMetrics } from "@/components/ui/CompactMetrics";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Dialog } from "@/components/ui/Dialog";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActiveFilterChips, FilterPopover, type ActiveChip, type FilterSection } from "@/components/ui/FilterPopover";
import { useToast } from "@/components/ui/ToastProvider";
import { SettingsField, settingsInputClass } from "@/components/internal/settings/fields";
import { cn } from "@/lib/utils";
import {
  ATIVIDADE_PRESETS,
  CANDIDATURA_PRESETS,
  EMPTY_FILTERS,
  ENTRADA_PRESETS,
  SITUATION_META,
  SORT_OPTIONS,
  TALENT_SITUATIONS,
  countActiveFilters,
  fullDateTime,
  hasAnyCriteria,
  locationLabel,
  originLabel,
  parseTalentFilters,
  relativeDay,
  sameFilters,
  serializeTalentFilters,
  type DatePreset,
  type TalentFilters,
  type TalentSort,
} from "@/lib/talentos/crm";
import {
  archiveTalentsAction,
  changeTalentStatus,
  deleteSegment,
  favoriteTalents,
  restoreTalentsAction,
  saveSegment,
  updateSegment,
  type BulkTarget,
  type SegmentDto,
} from "@/lib/talentos/actions";
import type { TalentFacets, TalentPage, TalentRow } from "@/lib/talentos/list";
import type { TagItem } from "@/lib/talentos/service";
import { AddTalentDialog } from "./AddTalentDialog";
import { AddToJobDialog } from "./AddToJobDialog";
import { TagBulkDialog } from "./TagBulkDialog";
import { TalentDrawer } from "./TalentDrawer";
import type { TalentTab } from "./TalentWorkspace";
import { FavoriteToggle, Missing, ProfileLine, SituationBadge, TagChip, TalentAvatar } from "./talent-ui";
import { useTalentTags } from "./useTalentData";

interface Props {
  page: TalentPage;
  filters: TalentFilters;
  sort: TalentSort;
  asc: boolean;
  facets: TalentFacets;
  tags: TagItem[];
  jobs: Array<{ id: string; title: string; code: string | null }>;
  stages: Array<{ id: string; name: string }>;
  segments: SegmentDto[];
  activeSegmentId: string | null;
  canManage: boolean;
  initialTalentId: string | null;
}

type BulkDialog = "job" | "tag-add" | "tag-remove" | "archive" | null;

const PRESET_LABEL = (list: Array<{ value: DatePreset; label: string }>, v: string) => list.find((p) => p.value === v)?.label ?? v;

export function TalentBank({
  page,
  filters,
  sort,
  asc,
  facets,
  tags: initialTags,
  jobs,
  stages,
  segments,
  activeSegmentId,
  canManage,
  initialTalentId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const { tags, createTag } = useTalentTags(initialTags);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  // ── Drawer ──
  const [openId, setOpenId] = useState<string | null>(initialTalentId);
  const [openTab, setOpenTab] = useState<TalentTab>("resumo");
  const [openAction, setOpenAction] = useState<"edit" | null>(null);
  const openTalent = useCallback((id: string, tab: TalentTab = "resumo", action: "edit" | null = null) => {
    setOpenTab(tab);
    setOpenAction(action);
    setOpenId(id);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId) url.searchParams.set("talento", openId);
    else url.searchParams.delete("talento");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [openId]);

  // ── Navegação (filtros/ordem/página ficam na URL; o servidor consulta) ──
  const go = useCallback(
    (next: { filters?: TalentFilters; sort?: TalentSort; asc?: boolean; page?: number; seg?: string | null }) => {
      const f = next.filters ?? filters;
      const s = next.sort ?? sort;
      const opt = SORT_OPTIONS.find((o) => o.value === s) ?? SORT_OPTIONS[0];
      const a = next.asc ?? (next.sort && next.sort !== sort ? opt.defaultAsc : asc);
      const params = new URLSearchParams(serializeTalentFilters(f));
      if (s !== "atividade") params.set("ordem", s);
      if (a !== opt.defaultAsc) params.set("dir", a ? "asc" : "desc");
      if ((next.page ?? 1) > 1) params.set("page", String(next.page));
      const seg = next.seg === undefined ? activeSegmentId : next.seg;
      if (seg) params.set("seg", seg);
      if (openId) params.set("talento", openId);
      const qs = params.toString();
      startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
    },
    [filters, sort, asc, activeSegmentId, openId, pathname, router]
  );

  const setFilters = (patch: Partial<TalentFilters>) => go({ filters: { ...filters, ...patch } });

  // ── Busca com debounce ──
  const [q, setQ] = useState(filters.q);
  const lastSent = useRef(filters.q);
  useEffect(() => {
    setQ(filters.q);
    lastSent.current = filters.q;
  }, [filters.q]);
  useEffect(() => {
    if (q.trim() === lastSent.current.trim()) return;
    const t = setTimeout(() => {
      lastSent.current = q;
      go({ filters: { ...filters, q } });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // ── Seleção ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allResults, setAllResults] = useState(false);
  const [favOverride, setFavOverride] = useState<Map<string, boolean>>(new Map());
  useEffect(() => {
    setSelected(new Set());
    setAllResults(false);
    setFavOverride(new Map());
  }, [page.rows]);

  const pageIds = page.rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id)) && !allOnPage;
  const selectedCount = allResults ? page.total : selected.size;
  const target: BulkTarget = allResults ? { filter: serializeTalentFilters(filters) } : { ids: [...selected] };
  const clearSelection = () => {
    setSelected(new Set());
    setAllResults(false);
  };

  // ── Diálogos ──
  const [addOpen, setAddOpen] = useState(false);
  const [bulkDialog, setBulkDialog] = useState<BulkDialog>(null);
  const [rowTarget, setRowTarget] = useState<{ ids: string[]; subject: string } | null>(null);
  const [segmentDialog, setSegmentDialog] = useState<{ mode: "new" | "rename"; name: string } | null>(null);
  const [deleteSegmentOpen, setDeleteSegmentOpen] = useState(false);

  const activeSegment = segments.find((s) => s.id === activeSegmentId) ?? null;
  const segmentModified = activeSegment ? !sameFilters(parseTalentFilters(activeSegment.filtros), filters) : false;
  const viewingArchived = filters.situacao.length === 1 && filters.situacao[0] === "ARQUIVADO";

  const runBulk = async (
    fn: () => Promise<{ ok: true; count?: number } | { ok: false; error: string }>,
    success: (n: number) => string
  ) => {
    try {
      const r = await fn();
      if (!r.ok) {
        notify("error", r.error);
        return;
      }
      notify("success", success(r.count ?? selectedCount));
      clearSelection();
    } catch {
      notify("error", "Não foi possível concluir a ação. Tente novamente.");
    }
  };

  const toggleFavorite = async (row: TalentRow) => {
    const current = favOverride.get(row.id) ?? row.favorito;
    setFavOverride((m) => new Map(m).set(row.id, !current));
    try {
      const r = await favoriteTalents({ ids: [row.id] }, !current);
      if (!r.ok) {
        setFavOverride((m) => new Map(m).set(row.id, current));
        notify("error", r.error);
      }
    } catch {
      setFavOverride((m) => new Map(m).set(row.id, current));
      notify("error", "Não foi possível atualizar o favorito.");
    }
  };

  // ── Filtros (somente com dados que existem) ──
  const toggleIn = (key: "situacao" | "uf" | "cidade" | "cargo" | "area" | "tag" | "origem" | "vaga" | "etapa", value: string) => {
    const list = filters[key] as string[];
    setFilters({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } as Partial<TalentFilters>);
  };
  const setPreset = (key: "candidatura" | "entrada" | "atividade", value: string) =>
    setFilters({ [key]: filters[key] === value ? "" : (value as DatePreset) } as Partial<TalentFilters>);

  const sections: FilterSection[] = [
    {
      key: "situacao",
      title: "Situação",
      options: TALENT_SITUATIONS.map((s) => ({ value: s, label: SITUATION_META[s].label, count: facets.situacoes[s] ?? 0 })),
      selected: filters.situacao,
      onToggle: (v) => toggleIn("situacao", v),
    },
    {
      key: "tag",
      title: "Tags (com todas)",
      options: tags.map((t) => ({ value: t.id, label: t.name })),
      selected: filters.tag,
      onToggle: (v) => toggleIn("tag", v),
    },
    {
      key: "uf",
      title: "Estado",
      options: facets.estados.map((o) => ({ value: o.value, label: o.label ?? o.value, count: o.count })),
      selected: filters.uf,
      onToggle: (v) => toggleIn("uf", v),
    },
    {
      key: "cidade",
      title: "Cidade",
      options: facets.cidades.map((o) => ({ value: o.value, label: o.label ?? o.value, count: o.count })),
      selected: filters.cidade,
      onToggle: (v) => toggleIn("cidade", v),
    },
    {
      key: "cargo",
      title: "Cargo de interesse",
      options: facets.cargos.map((o) => ({ value: o.value, label: o.label ?? o.value, count: o.count })),
      selected: filters.cargo,
      onToggle: (v) => toggleIn("cargo", v),
    },
    {
      key: "area",
      title: "Área",
      options: facets.areas.map((o) => ({ value: o.value, label: o.label ?? o.value, count: o.count })),
      selected: filters.area,
      onToggle: (v) => toggleIn("area", v),
    },
    {
      key: "origem",
      title: "Origem",
      options: facets.origens.map((o) => ({ value: o.value, label: originLabel(o.value), count: o.count })),
      selected: filters.origem,
      onToggle: (v) => toggleIn("origem", v),
    },
    {
      key: "vaga",
      title: "Vaga anterior",
      options: jobs.map((j) => ({ value: j.id, label: j.code ? `${j.title} (${j.code})` : j.title })),
      selected: filters.vaga,
      onToggle: (v) => toggleIn("vaga", v),
    },
    {
      key: "etapa",
      title: "Etapa alcançada",
      options: stages.map((s) => ({ value: s.id, label: s.name })),
      selected: filters.etapa,
      onToggle: (v) => toggleIn("etapa", v),
    },
    {
      key: "candidatura",
      title: "Última candidatura",
      mode: "single",
      options: CANDIDATURA_PRESETS,
      selected: filters.candidatura ? [filters.candidatura] : [],
      onToggle: (v) => setPreset("candidatura", v),
    },
    {
      key: "entrada",
      title: "Entrada no banco",
      mode: "single",
      options: ENTRADA_PRESETS,
      selected: filters.entrada ? [filters.entrada] : [],
      onToggle: (v) => setPreset("entrada", v),
    },
    {
      key: "atividade",
      title: "Última atividade",
      mode: "single",
      options: ATIVIDADE_PRESETS,
      selected: filters.atividade ? [filters.atividade] : [],
      onToggle: (v) => setPreset("atividade", v),
    },
    {
      key: "avaliacao",
      title: "Avaliações",
      options: [{ value: "1", label: "Realizou avaliação" }],
      selected: filters.avaliacao ? ["1"] : [],
      onToggle: () => setFilters({ avaliacao: !filters.avaliacao }),
    },
  ];

  const labelOf = (key: string, value: string): string => {
    const s = sections.find((x) => x.key === key);
    return s?.options.find((o) => o.value === value)?.label ?? value;
  };

  const chips: ActiveChip[] = [
    ...(["situacao", "tag", "uf", "cidade", "cargo", "area", "origem", "vaga", "etapa"] as const).flatMap((key) =>
      (filters[key] as string[]).map((v) => ({
        key: `${key}:${v}`,
        label: `${sections.find((s) => s.key === key)?.title.replace(" (com todas)", "") ?? key}: ${labelOf(key, v)}`,
        onRemove: () => toggleIn(key, v),
      }))
    ),
    ...(filters.candidatura
      ? [{ key: "candidatura", label: `Candidatura: ${PRESET_LABEL(CANDIDATURA_PRESETS, filters.candidatura).toLowerCase()}`, onRemove: () => setFilters({ candidatura: "" }) }]
      : []),
    ...(filters.entrada
      ? [{ key: "entrada", label: `Entrada: ${PRESET_LABEL(ENTRADA_PRESETS, filters.entrada).toLowerCase()}`, onRemove: () => setFilters({ entrada: "" }) }]
      : []),
    ...(filters.atividade
      ? [{ key: "atividade", label: `Atividade: ${PRESET_LABEL(ATIVIDADE_PRESETS, filters.atividade).toLowerCase()}`, onRemove: () => setFilters({ atividade: "" }) }]
      : []),
    ...(filters.avaliacao ? [{ key: "avaliacao", label: "Realizou avaliação", onRemove: () => setFilters({ avaliacao: false }) }] : []),
  ];

  const clearAll = () => {
    setQ("");
    lastSent.current = "";
    go({ filters: EMPTY_FILTERS, seg: null });
  };
  const clearPanelFilters = () => go({ filters: { ...EMPTY_FILTERS, q: filters.q, favorito: filters.favorito } });

  const bankEmpty = facets.total === 0 && facets.arquivados === 0;
  const criteria = hasAnyCriteria(filters);

  // ── Segmentos ──
  const submitSegment = async (name: string) => {
    if (!segmentDialog) return;
    const r =
      segmentDialog.mode === "new"
        ? await saveSegment(name, serializeTalentFilters(filters))
        : activeSegment
        ? await updateSegment(activeSegment.id, { nome: name })
        : ({ ok: false, error: "Segmento não encontrado." } as const);
    if (!r.ok) return r.error;
    notify("success", segmentDialog.mode === "new" ? "Segmento salvo." : "Segmento renomeado.");
    setSegmentDialog(null);
    if (segmentDialog.mode === "new") go({ seg: r.segment.id });
    return null;
  };

  const segmentItems: DropdownMenuItem[] =
    segments.length === 0
      ? [{ label: "Nenhum segmento salvo", disabled: true }]
      : segments.map((s) => ({
          label: s.nome,
          icon: Bookmark,
          hint: s.id === activeSegmentId ? "ativo" : undefined,
          onSelect: () => go({ filters: parseTalentFilters(s.filtros), seg: s.id }),
        }));

  const rowMenu = (row: TalentRow): DropdownMenuItem[] => {
    const fav = favOverride.get(row.id) ?? row.favorito;
    const archived = row.situacao === "ARQUIVADO";
    const unavailable = row.statusBanco === "INDISPONIVEL" || row.statusBanco === "NAO_ADERENTE";
    const one: BulkTarget = { ids: [row.id] };
    return [
      { label: "Abrir perfil", icon: Eye, onSelect: () => openTalent(row.id) },
      { label: "Abrir perfil completo", icon: ExternalLink, href: `/talentos/${row.id}` },
      ...(canManage && !archived
        ? ([
            {
              label: "Adicionar à vaga",
              icon: BriefcaseBusiness,
              onSelect: () => {
                setRowTarget({ ids: [row.id], subject: row.nomeCompleto });
                setBulkDialog("job");
              },
            },
            {
              label: "Adicionar tag",
              icon: Tag,
              onSelect: () => {
                setRowTarget({ ids: [row.id], subject: row.nomeCompleto });
                setBulkDialog("tag-add");
              },
            },
          ] as DropdownMenuItem[])
        : []),
      ...(canManage
        ? ([
            { label: fav ? "Remover dos favoritos" : "Favoritar", icon: fav ? StarOff : Star, onSelect: () => toggleFavorite(row) },
            { label: "Editar dados", icon: Pencil, onSelect: () => openTalent(row.id, "resumo", "edit") },
          ] as DropdownMenuItem[])
        : []),
      ...(row.curriculoUrl ? [{ label: "Baixar currículo", icon: Download, href: `/api/talentos/${row.id}/resume?download=1` } as DropdownMenuItem] : []),
      ...(canManage
        ? ([
            { type: "separator" },
            ...(archived
              ? [
                  {
                    label: "Restaurar do arquivo",
                    icon: ArchiveRestore,
                    onSelect: () => runBulk(() => restoreTalentsAction(one), () => "Talento restaurado."),
                  },
                ]
              : [
                  unavailable
                    ? {
                        label: "Marcar como disponível",
                        icon: CheckCircle2,
                        onSelect: () => runBulk(() => changeTalentStatus(one, "ATIVO"), () => "Talento marcado como disponível."),
                      }
                    : {
                        label: "Marcar como indisponível",
                        icon: CircleSlash,
                        onSelect: () => runBulk(() => changeTalentStatus(one, "INDISPONIVEL"), () => "Talento marcado como indisponível."),
                      },
                  {
                    label: "Arquivar",
                    icon: Archive,
                    danger: true,
                    onSelect: () => {
                      setRowTarget({ ids: [row.id], subject: row.nomeCompleto });
                      setBulkDialog("archive");
                    },
                  },
                ]),
          ] as DropdownMenuItem[])
        : []),
    ];
  };

  // Alvo dos diálogos: a linha (menu •••) ou a seleção (barra de ações).
  const dialogTarget: BulkTarget = rowTarget ? { ids: rowTarget.ids } : target;
  const dialogCount = rowTarget ? rowTarget.ids.length : selectedCount;
  const dialogSubject = rowTarget ? rowTarget.subject : `${selectedCount} ${selectedCount === 1 ? "talento" : "talentos"}`;
  const closeDialog = () => {
    setBulkDialog(null);
    setRowTarget(null);
  };

  const from = (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.total, page.page * page.pageSize);
  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <div>
      {/* ── Cabeçalho ── */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-sora text-2xl font-semibold tracking-tight text-wg-ink md:text-page-title">
            <Star className="h-6 w-6 text-wg-green-dark" aria-hidden />
            Banco de Talentos
          </h1>
          <p className="mt-1 text-body text-wg-ink-muted">Encontre, organize e reutilize talentos em futuras oportunidades.</p>
        </div>
        {canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
            Adicionar talento
          </Button>
        )}
      </div>

      {!bankEmpty && (
        <CompactMetrics
          className="mb-4"
          total={{ value: facets.total.toLocaleString("pt-BR"), label: facets.total === 1 ? "talento" : "talentos" }}
          items={[
            { label: "novos este mês", value: facets.novosMes, href: "/talentos?entrada=mes", hint: "Entraram no banco desde o dia 1º" },
            { label: "favoritos", value: facets.favoritos, href: "/talentos?favorito=1" },
            {
              label: "disponíveis",
              value: facets.situacoes.DISPONIVEL ?? 0,
              tone: "success",
              href: "/talentos?situacao=DISPONIVEL",
              hint: SITUATION_META.DISPONIVEL.hint,
            },
            {
              label: "em processo",
              value: facets.situacoes.EM_PROCESSO ?? 0,
              tone: "info",
              href: "/talentos?situacao=EM_PROCESSO",
              hint: SITUATION_META.EM_PROCESSO.hint,
            },
            ...(facets.arquivados > 0
              ? [{ label: "arquivados", value: facets.arquivados, href: "/talentos?situacao=ARQUIVADO", hint: "Fora da lista padrão" }]
              : []),
          ]}
        />
      )}

      {bankEmpty ? (
        <div className="rounded-card border border-wg-border-lighter bg-white">
          <EmptyState
            icon={Star}
            title="Seu Banco de Talentos está vazio"
            description="Talentos adicionados para futuras oportunidades aparecerão aqui."
            action={
              canManage ? (
                <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                  Adicionar talento
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* ── Visões: Todos · Favoritos · Segmentos ── */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Visões do banco">
            {[
              { key: "todos", label: "Todos", active: !filters.favorito && !activeSegmentId, onClick: () => go({ filters: { ...filters, favorito: false }, seg: null }) },
              {
                key: "fav",
                label: `Favoritos`,
                count: facets.favoritos,
                active: filters.favorito && !activeSegmentId,
                onClick: () => go({ filters: { ...filters, favorito: !filters.favorito }, seg: null }),
              },
            ].map((v) => (
              <button
                key={v.key}
                type="button"
                aria-pressed={v.active}
                onClick={v.onClick}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
                  v.active ? "border-wg-green bg-wg-green text-wg-dark" : "border-wg-border-light bg-white text-wg-ink-secondary hover:border-wg-green/60 hover:text-wg-ink"
                )}
              >
                {v.key === "fav" && <Star className={cn("h-3.5 w-3.5", v.active ? "fill-current" : "")} aria-hidden />}
                {v.label}
                {v.count !== undefined && <span className={cn("tabular-nums text-[12px]", v.active ? "text-wg-dark/70" : "text-wg-ink-muted")}>{v.count}</span>}
              </button>
            ))}
            <DropdownMenu
              align="left"
              trigger={
                <>
                  <Bookmark aria-hidden className={activeSegment ? "fill-current" : undefined} />
                  {activeSegment ? activeSegment.nome : "Segmentos salvos"}
                  {segments.length > 0 && !activeSegment && <span className="tabular-nums text-[12px] text-wg-ink-muted">{segments.length}</span>}
                  <ChevronDown aria-hidden />
                </>
              }
              triggerClassName={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5",
                activeSegment ? "border-wg-green bg-wg-green text-wg-dark" : "border-wg-border-light bg-white text-wg-ink-secondary hover:border-wg-green/60 hover:text-wg-ink"
              )}
              items={segmentItems}
            />
            {activeSegment && canManage && (
              <>
                {segmentModified && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const r = await updateSegment(activeSegment.id, { filtros: serializeTalentFilters(filters) });
                      if (!r.ok) notify("error", r.error);
                      else notify("success", "Segmento atualizado com os filtros atuais.");
                    }}
                  >
                    Atualizar segmento
                  </Button>
                )}
                <DropdownMenu
                  ariaLabel="Opções do segmento"
                  trigger={<MoreHorizontal aria-hidden />}
                  triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                  items={[
                    { label: "Renomear", icon: Pencil, onSelect: () => setSegmentDialog({ mode: "rename", name: activeSegment.nome }) },
                    { label: "Excluir segmento", icon: Trash2, danger: true, onSelect: () => setDeleteSegmentOpen(true) },
                  ]}
                />
              </>
            )}
            {activeSegment && (
              <span className="text-meta text-wg-ink-muted">
                {segmentModified ? "Filtros alterados em relação ao segmento." : `Criado por ${activeSegment.criadoPorNome}. Atualiza sozinho com novos talentos.`}
              </span>
            )}
          </div>

          {/* ── Barra de ferramentas ── */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Buscar talentos</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wg-ink-muted" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, e-mail, telefone, cargo, habilidade ou palavra-chave..."
                className="h-9 w-full rounded-control border border-wg-border-light bg-white pl-9 pr-3 text-body text-wg-ink placeholder:text-[#9AA590] focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30"
              />
            </label>
            <FilterPopover sections={sections} activeCount={countActiveFilters(filters)} onClear={clearPanelFilters} />
            <div className="flex items-center gap-1">
              <label htmlFor="talent-sort" className="sr-only">
                Ordenar por
              </label>
              <select
                id="talent-sort"
                value={sort}
                onChange={(e) => go({ sort: e.target.value as TalentSort })}
                className="h-9 cursor-pointer rounded-control border border-wg-border-light bg-white pl-3 pr-8 text-[13px] font-semibold text-wg-ink-secondary focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    Ordenar: {o.label}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => go({ asc: !asc })}
                aria-label={asc ? "Ordem crescente — inverter" : "Ordem decrescente — inverter"}
                title={asc ? "Crescente" : "Decrescente"}
              >
                {asc ? <ArrowUpNarrowWide aria-hidden /> : <ArrowDownWideNarrow aria-hidden />}
              </Button>
            </div>
            {canManage && criteria && (!activeSegment || segmentModified) && (
              <Button variant="secondary" icon={BookmarkPlus} onClick={() => setSegmentDialog({ mode: "new", name: "" })}>
                Salvar segmento
              </Button>
            )}
          </div>

          {chips.length > 0 && (
            <div className="mb-3">
              <ActiveFilterChips chips={chips} onClear={clearPanelFilters} />
            </div>
          )}

          {/* ── Ações em massa ── */}
          {canManage && selectedCount > 0 && (
            <div
              role="region"
              aria-label="Ações em massa"
              className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-card border border-wg-green/50 bg-wg-sidebar px-3 py-2 shadow-sm"
            >
              <p className="mr-1 flex items-center gap-1.5 text-body font-semibold text-wg-ink" aria-live="polite">
                <CheckCircle2 className="h-4 w-4 text-wg-green-dark" aria-hidden />
                {selectedCount} {selectedCount === 1 ? "talento selecionado" : "talentos selecionados"}
              </p>
              {allOnPage && !allResults && page.total > page.rows.length && (
                <button type="button" onClick={() => setAllResults(true)} className="text-meta font-semibold text-wg-green-dark hover:underline">
                  Selecionar todos os {page.total} resultados
                </button>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {!viewingArchived && (
                  <>
                    <Button size="sm" variant="primary" icon={BriefcaseBusiness} onClick={() => setBulkDialog("job")}>
                      Adicionar à vaga
                    </Button>
                    <Button size="sm" variant="secondary" icon={Tag} onClick={() => setBulkDialog("tag-add")}>
                      Adicionar tag
                    </Button>
                  </>
                )}
                <DropdownMenu
                  trigger={
                    <>
                      Mais ações
                      <ChevronDown aria-hidden />
                    </>
                  }
                  triggerClassName={buttonVariants({ variant: "secondary", size: "sm" })}
                  items={[
                    { label: "Remover tag", icon: Tags, onSelect: () => setBulkDialog("tag-remove") },
                    { label: "Favoritar", icon: Star, onSelect: () => runBulk(() => favoriteTalents(target, true), () => "Favoritos atualizados.") },
                    { label: "Remover dos favoritos", icon: StarOff, onSelect: () => runBulk(() => favoriteTalents(target, false), () => "Favoritos atualizados.") },
                    { type: "separator" },
                    {
                      label: "Marcar como disponível",
                      icon: CheckCircle2,
                      onSelect: () => runBulk(() => changeTalentStatus(target, "ATIVO"), (n) => `${n} ${n === 1 ? "talento marcado" : "talentos marcados"} como disponível.`),
                    },
                    {
                      label: "Marcar como indisponível",
                      icon: CircleSlash,
                      onSelect: () => runBulk(() => changeTalentStatus(target, "INDISPONIVEL"), (n) => `${n} ${n === 1 ? "talento marcado" : "talentos marcados"} como indisponível.`),
                    },
                    { type: "separator" },
                    viewingArchived
                      ? {
                          label: "Restaurar do arquivo",
                          icon: ArchiveRestore,
                          onSelect: () => runBulk(() => restoreTalentsAction(target), (n) => `${n} ${n === 1 ? "talento restaurado" : "talentos restaurados"}.`),
                        }
                      : { label: "Arquivar", icon: Archive, danger: true, onSelect: () => setBulkDialog("archive") },
                  ]}
                />
                <Button size="icon-sm" variant="tertiary" onClick={clearSelection} aria-label="Limpar seleção" title="Limpar seleção">
                  <X aria-hidden />
                </Button>
              </div>
            </div>
          )}

          {/* ── Tabela ── */}
          <div
            className={cn("overflow-x-auto rounded-card border border-wg-border-lighter bg-white transition-opacity", isPending && "opacity-60")}
            aria-busy={isPending}
          >
            {page.rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="Nenhum talento encontrado"
                description="Não encontramos talentos com os critérios selecionados."
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <table className="w-full text-left text-body">
                <caption className="sr-only">Talentos do banco — {page.total} resultados</caption>
                <thead>
                  <tr className="border-b border-wg-border-lighter bg-wg-bg/60">
                    {canManage && (
                      <th scope="col" className="w-10 py-2.5 pl-4">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos os talentos desta página"
                          checked={allOnPage}
                          ref={(el) => {
                            if (el) el.indeterminate = someOnPage;
                          }}
                          onChange={() => {
                            setAllResults(false);
                            setSelected(allOnPage ? new Set() : new Set(pageIds));
                          }}
                          className="h-4 w-4 cursor-pointer accent-[#4F6930]"
                        />
                      </th>
                    )}
                    <SortHeader label="Talento" active={sort === "nome"} asc={asc} onClick={() => go({ sort: "nome", asc: sort === "nome" ? !asc : true })} />
                    <th scope="col" className="hidden px-3 py-2.5 text-label uppercase tracking-wide text-wg-ink-muted md:table-cell">Perfil</th>
                    <th scope="col" className="hidden px-3 py-2.5 text-label uppercase tracking-wide text-wg-ink-muted sm:table-cell">Situação</th>
                    <th scope="col" className="hidden px-3 py-2.5 text-label uppercase tracking-wide text-wg-ink-muted lg:table-cell">Localização</th>
                    <th scope="col" className="hidden px-3 py-2.5 text-label uppercase tracking-wide text-wg-ink-muted lg:table-cell">Histórico</th>
                    <th scope="col" className="hidden px-3 py-2.5 text-label uppercase tracking-wide text-wg-ink-muted xl:table-cell">Tags</th>
                    <SortHeader
                      label="Última atividade"
                      className="hidden sm:table-cell"
                      active={sort === "atividade"}
                      asc={asc}
                      onClick={() => go({ sort: "atividade", asc: sort === "atividade" ? !asc : false })}
                    />
                    <th scope="col" className="w-12 py-2.5 pr-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((row) => {
                    const isSelected = allResults || selected.has(row.id);
                    const fav = favOverride.get(row.id) ?? row.favorito;
                    const area = row.areaInteresse ?? row.ultimoJobArea;
                    const loc = locationLabel(row.cidade?.trim(), row.estado?.trim());
                    const rowTags = row.tagIds.map((id) => tagById.get(id)).filter((t): t is TagItem => Boolean(t));
                    return (
                      <tr
                        key={row.id}
                        onClick={() => openTalent(row.id)}
                        className={cn(
                          "cursor-pointer border-b border-wg-border-lighter align-middle transition-colors last:border-b-0",
                          isSelected ? "bg-[#F3F9E9]" : openId === row.id ? "bg-wg-bg" : "hover:bg-wg-bg/70"
                        )}
                      >
                        {canManage && (
                          <td className={cn("py-3", isSelected ? "border-l-[3px] border-wg-green pl-[13px]" : "pl-4")} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${row.nomeCompleto}`}
                              checked={isSelected}
                              onChange={() => {
                                if (allResults) {
                                  setAllResults(false);
                                  setSelected(new Set(pageIds.filter((id) => id !== row.id)));
                                  return;
                                }
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(row.id)) next.delete(row.id);
                                  else next.add(row.id);
                                  return next;
                                });
                              }}
                              className="h-4 w-4 cursor-pointer accent-[#4F6930]"
                            />
                          </td>
                        )}
                        <td className="max-w-[320px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <TalentAvatar name={row.nomeCompleto} size="sm" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTalent(row.id);
                                  }}
                                  className="truncate rounded text-left font-semibold text-wg-ink hover:text-wg-green-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
                                >
                                  {row.nomeCompleto}
                                </button>
                                <FavoriteToggle name={row.nomeCompleto} active={fav} onToggle={canManage ? () => toggleFavorite(row) : undefined} />
                              </div>
                              <p className="truncate text-meta text-wg-ink-muted">{row.email}</p>
                              {/* Telas estreitas: perfil, situação e atividade sob o nome */}
                              <div className="mt-1 md:hidden">
                                <ProfileLine cargo={row.cargoDesejado} cargoFromCv={row.ultimoCargoCv} area={area} />
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 sm:hidden">
                                <SituationBadge situation={row.situacao} />
                                <span className="text-meta text-wg-ink-muted" title={fullDateTime(row.ultimaAtividadeEm)}>
                                  {relativeDay(row.ultimaAtividadeEm)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden max-w-[220px] px-3 py-3 md:table-cell">
                          <ProfileLine cargo={row.cargoDesejado} cargoFromCv={row.ultimoCargoCv} area={area} />
                        </td>
                        <td className="hidden px-3 py-3 sm:table-cell">
                          <SituationBadge situation={row.situacao} />
                        </td>
                        <td className="hidden px-3 py-3 text-wg-ink-secondary lg:table-cell">{loc ?? <Missing>Localização não informada</Missing>}</td>
                        <td className="hidden max-w-[220px] px-3 py-3 lg:table-cell">
                          {row.processos === 0 ? (
                            <Missing>Ainda não participou de processo</Missing>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTalent(row.id, "historico");
                              }}
                              className="block max-w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
                              title="Ver histórico"
                            >
                              <span className="block text-body font-medium text-wg-ink hover:text-wg-green-dark">
                                {row.processos} {row.processos === 1 ? "processo" : "processos"}
                              </span>
                              <span className="block truncate text-meta text-wg-ink-muted">
                                Último: {row.ultimoJobTitulo}
                                {row.ultimaEtapaNome ? ` · ${row.ultimaEtapaNome}` : ""}
                              </span>
                            </button>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 xl:table-cell">
                          {rowTags.length === 0 ? (
                            <span className="text-meta text-wg-ink-muted/70" aria-label="Sem tags">
                              —
                            </span>
                          ) : (
                            <div className="flex max-w-[200px] flex-wrap gap-1">
                              {rowTags.slice(0, 2).map((t) => (
                                <TagChip key={t.id} name={t.name} color={t.color} />
                              ))}
                              {rowTags.length > 2 && (
                                <span className="text-meta text-wg-ink-muted" title={rowTags.slice(2).map((t) => t.name).join(", ")}>
                                  +{rowTags.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-3 text-meta text-wg-ink-secondary sm:table-cell">
                          <span title={fullDateTime(row.ultimaAtividadeEm)}>{relativeDay(row.ultimaAtividadeEm)}</span>
                        </td>
                        <td className="py-3 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu
                            portal
                            ariaLabel={`Ações de ${row.nomeCompleto}`}
                            trigger={<MoreHorizontal aria-hidden />}
                            triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                            items={rowMenu(row)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Paginação ── */}
          {page.total > 0 && (
            <nav aria-label="Paginação" className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-meta text-wg-ink-muted">
                {from.toLocaleString("pt-BR")}–{to.toLocaleString("pt-BR")} de {page.total.toLocaleString("pt-BR")}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page.page <= 1 || isPending} onClick={() => go({ page: page.page - 1 })}>
                    Anterior
                  </Button>
                  <span className="px-1 text-meta tabular-nums text-wg-ink-secondary">
                    {page.page} / {totalPages}
                  </span>
                  <Button size="sm" variant="secondary" disabled={page.page >= totalPages || isPending} onClick={() => go({ page: page.page + 1 })}>
                    Próxima
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              )}
            </nav>
          )}
        </>
      )}

      {/* ── Diálogos ── */}
      {canManage && (
        <>
          <AddTalentDialog open={addOpen} onClose={() => setAddOpen(false)} tags={tags} onCreateTag={createTag} onOpenTalent={(id) => openTalent(id)} />
          <AddToJobDialog
            open={bulkDialog === "job"}
            onClose={closeDialog}
            target={dialogTarget}
            subject={dialogSubject}
            count={dialogCount}
            onDone={clearSelection}
          />
          <TagBulkDialog
            open={bulkDialog === "tag-add" || bulkDialog === "tag-remove"}
            mode={bulkDialog === "tag-remove" ? "remove" : "add"}
            onClose={closeDialog}
            target={dialogTarget}
            subject={dialogSubject}
            tags={tags}
            onCreateTag={createTag}
            onDone={clearSelection}
          />
          <ConfirmModal
            isOpen={bulkDialog === "archive"}
            variant="warning"
            title={dialogCount === 1 ? "Arquivar talento?" : `Arquivar ${dialogCount} talentos?`}
            message="Arquivados saem da lista padrão, mas o histórico e as candidaturas são mantidos. Você pode restaurá-los a qualquer momento pelo filtro Situação › Arquivado."
            confirmLabel="Arquivar"
            onCancel={closeDialog}
            onConfirm={() => {
              const t = dialogTarget;
              closeDialog();
              void runBulk(() => archiveTalentsAction(t), (n) => (n === 1 ? "Talento arquivado." : `${n} talentos arquivados.`));
            }}
          />
          <SegmentNameDialog
            state={segmentDialog}
            onClose={() => setSegmentDialog(null)}
            onSubmit={submitSegment}
            summary={chips.map((c) => c.label).concat(filters.q ? [`Busca: "${filters.q}"`] : [], filters.favorito ? ["Favoritos"] : [])}
          />
          <ConfirmModal
            isOpen={deleteSegmentOpen}
            title="Excluir segmento?"
            message={`O segmento "${activeSegment?.nome ?? ""}" será excluído. Nenhum talento é alterado — só a combinação de filtros salva.`}
            confirmLabel="Excluir"
            onCancel={() => setDeleteSegmentOpen(false)}
            onConfirm={async () => {
              setDeleteSegmentOpen(false);
              if (!activeSegment) return;
              const r = await deleteSegment(activeSegment.id);
              if (!r.ok) notify("error", r.error);
              else {
                notify("success", "Segmento excluído.");
                go({ seg: null });
              }
            }}
          />
        </>
      )}

      <TalentDrawer
        talentId={openId}
        initialTab={openTab}
        initialAction={openAction}
        tags={tags}
        onCreateTag={createTag}
        onClose={() => setOpenId(null)}
        onOpenTalent={(id) => openTalent(id)}
      />
    </div>
  );
}

function SortHeader({
  label,
  active,
  asc,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th scope="col" aria-sort={active ? (asc ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 rounded text-label uppercase tracking-wide hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
          active ? "text-wg-ink" : "text-wg-ink-muted"
        )}
      >
        {label}
        {active && (asc ? <ArrowUpNarrowWide className="h-3 w-3" aria-hidden /> : <ArrowDownWideNarrow className="h-3 w-3" aria-hidden />)}
      </button>
    </th>
  );
}

function SegmentNameDialog({
  state,
  onClose,
  onSubmit,
  summary,
}: {
  state: { mode: "new" | "rename"; name: string } | null;
  onClose: () => void;
  onSubmit: (name: string) => Promise<string | null | undefined>;
  summary: string[];
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state) {
      setName(state.name);
      setError(null);
    }
  }, [state]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const err = await onSubmit(name);
      if (err) setError(err);
    } catch {
      setError("Não foi possível salvar o segmento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={state !== null}
      onClose={onClose}
      busy={saving}
      title={state?.mode === "rename" ? "Renomear segmento" : "Salvar segmento"}
      description={
        state?.mode === "rename"
          ? undefined
          : "O segmento guarda os filtros, não uma lista fixa: novos talentos que atenderem aos critérios aparecem nele automaticamente."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="segment-form" loading={saving} disabled={!name.trim()}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="segment-form" onSubmit={submit} className="space-y-3">
        <SettingsField id="seg-name" label="Nome do segmento" required error={error}>
          <input
            id="seg-name"
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="Ex.: Motoristas — Curitiba e região"
            aria-invalid={Boolean(error)}
            className={settingsInputClass}
          />
        </SettingsField>
        {state?.mode === "new" && summary.length > 0 && (
          <div>
            <p className="mb-1.5 text-label font-semibold text-wg-ink-secondary">Critérios</p>
            <ul className="flex flex-wrap gap-1.5">
              {summary.map((s) => (
                <li key={s} className="rounded-full border border-wg-border-light bg-wg-bg px-2.5 py-0.5 text-[12px] text-wg-ink-secondary">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Dialog>
  );
}
