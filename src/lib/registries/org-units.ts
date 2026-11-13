// Filial e área vindas dos cadastros (Configurações › Cadastros). Puro e testado.
//
// Solicitação e vaga guardam o id do cadastro E o nome copiado nas colunas de texto
// (job_requests.location/department, jobs.company/department/city/state): portal, feeds,
// Intranet e WG Jornada leem o texto. Registro antigo sem id mantém o texto que tinha.

export interface OrgUnit {
  id: string;
  name: string;
  active: boolean;
  /** Só filiais. */
  city?: string | null;
  state?: string | null;
}

/** Opções do select: os ativos + o item atual mesmo desativado (para não sumir do registro). */
export function selectableOptions(options: OrgUnit[], currentId: string | null): OrgUnit[] {
  return options.filter((o) => o.active || o.id === currentId);
}

export type OrgUnitsResult =
  | {
      ok: true;
      branchId: string | null;
      areaId: string | null;
      location: string | null;
      department: string | null;
      city: string | null;
      state: string | null;
    }
  | { ok: false; field: "branchId" | "areaId"; message: string };

/**
 * Resolve filial e área para gravação. `requireIds` = envio novo (filial e área obrigatórias
 * e ativas); sem ele (edição), o que faltar fica com o texto legado do registro.
 */
export function resolveOrgUnits(
  input: {
    branchId?: string | null;
    areaId?: string | null;
    legacyLocation?: string | null;
    legacyDepartment?: string | null;
  },
  branches: OrgUnit[],
  areas: OrgUnit[],
  opts: { requireIds: boolean }
): OrgUnitsResult {
  const pick = (
    id: string | null | undefined,
    list: OrgUnit[],
    field: "branchId" | "areaId",
    labels: { missing: string; notFound: string; inactive: string }
  ): { ok: true; unit: OrgUnit | null } | { ok: false; field: "branchId" | "areaId"; message: string } => {
    if (!id) return opts.requireIds ? { ok: false, field, message: labels.missing } : { ok: true, unit: null };
    const unit = list.find((u) => u.id === id);
    if (!unit) return { ok: false, field, message: labels.notFound };
    if (opts.requireIds && !unit.active) return { ok: false, field, message: labels.inactive };
    return { ok: true, unit };
  };

  const branch = pick(input.branchId, branches, "branchId", {
    missing: "Escolha a filial.",
    notFound: "Filial não encontrada.",
    inactive: "Esta filial está desativada.",
  });
  if (!branch.ok) return branch;
  const area = pick(input.areaId, areas, "areaId", {
    missing: "Escolha a área.",
    notFound: "Área não encontrada.",
    inactive: "Esta área está desativada.",
  });
  if (!area.ok) return area;

  return {
    ok: true,
    branchId: branch.unit?.id ?? null,
    areaId: area.unit?.id ?? null,
    location: branch.unit?.name ?? input.legacyLocation ?? null,
    department: area.unit?.name ?? input.legacyDepartment ?? null,
    city: branch.unit?.city ?? null,
    state: branch.unit?.state ?? null,
  };
}

/**
 * Antes de a solicitação seguir no fluxo (enviar, validar, aprovar): precisa ter filial e área —
 * do cadastro ou, em solicitação antiga, o texto legado. Rascunho pode ter sido salvo sem elas.
 */
export function missingOrgUnitsMessage(r: {
  branchId: string | null;
  location: string | null;
  areaId: string | null;
  department: string | null;
}): string | null {
  const hasBranch = Boolean(r.branchId || r.location?.trim());
  const hasArea = Boolean(r.areaId || r.department?.trim());
  return hasBranch && hasArea ? null : "Escolha a filial e a área antes de enviar.";
}
