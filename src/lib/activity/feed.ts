import type { SupabaseClient } from "@supabase/supabase-js";
import { JOB_REQUEST_STATUS_LABELS } from "@/lib/job-requests/constants";
import { eventItem as jobEventItem } from "@/lib/jobs/history";
import { JOB_PROCESS_STATUS_LABELS } from "@/lib/recruitment/job-presentation";
import {
  ADMISSION_LOG_ACTIONS,
  HIDDEN_JOB_EVENTS,
  logActionsFor,
  requestEventType,
  timestampSortKey,
  type ActivityCategory,
} from "./catalog";
import type { FieldChangeMeta } from "./log";

// Feed da página Atividades: junta as fontes reais de histórico (ver catalog.ts) numa
// timeline única, paginada por CURSOR ("carregar mais"). Cada fonte é consultada com os
// filtros aplicados no banco e limite de página; o merge é feito aqui.
//
// Cursor = timestamp do último item exibido + ids exibidos com esse MESMO timestamp.
// A próxima página busca `<= before` e descarta esses ids — assim eventos gravados no
// mesmo instante (ex.: CREATED e SUBMITTED de uma solicitação) nunca somem na virada.
// Os timestamps viajam como vieram do banco (microssegundos), sem passar pelo Date do JS.

export const ACTIVITY_PAGE_SIZE = 30;

export type ActivityPeriod = "7d" | "30d" | "90d" | "tudo";

export const ACTIVITY_PERIODS: Array<{ value: ActivityPeriod; label: string }> = [
  { value: "tudo", label: "Todo o período" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
];

export interface ActivityFilters {
  q: string;
  period: ActivityPeriod;
  user: string;
  category: ActivityCategory | "";
  company: string;
  branch: string;
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilters = { q: "", period: "tudo", user: "", category: "", company: "", branch: "" };

export interface ActivityCursor {
  before: string;
  skip: string[];
}

export interface ActivityItem {
  id: string;
  at: string;
  type: string;
  /** Título específico (ex.: "Posição 2 adicionada"); se ausente, usa o rótulo do tipo. */
  title: string | null;
  actor: { id: string | null; name: string };
  subject: { name: string; detail: string | null; href: string | null };
  summary: string | null;
  change: { from: string; to: string } | null;
  changes: FieldChangeMeta[];
  details: string[];
  source: { table: string; id: string; code: string };
}

const SAFE_ID = /^[\w-]{1,64}$/;

export function parseActivityFilters(p: Record<string, string | undefined>): ActivityFilters {
  const id = (v?: string) => (v && SAFE_ID.test(v) ? v : "");
  const cat = ACTIVITY_CATEGORY_VALUES.includes(p.tipo as ActivityCategory) ? (p.tipo as ActivityCategory) : "";
  const period = (["7d", "30d", "90d"] as const).includes(p.periodo as "7d") ? (p.periodo as ActivityPeriod) : "tudo";
  return {
    q: (p.q ?? "").slice(0, 80),
    period,
    user: id(p.usuario),
    category: cat,
    company: id(p.empresa),
    branch: id(p.filial),
  };
}

const ACTIVITY_CATEGORY_VALUES: ActivityCategory[] = [
  "admissoes",
  "documentos",
  "solicitacoes",
  "vagas",
  "candidatos",
  "usuarios",
  "configuracoes",
];

export function activityFiltersToQuery(f: ActivityFilters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.period !== "tudo") p.set("periodo", f.period);
  if (f.user) p.set("usuario", f.user);
  if (f.category) p.set("tipo", f.category);
  if (f.company) p.set("empresa", f.company);
  if (f.branch) p.set("filial", f.branch);
  return p.toString();
}

// ─── Consulta ────────────────────────────────────────────────────────────────

interface RawRow {
  id: string;
  sortKey: string;
  at: string;
  build: (ctx: Ctx) => ActivityItem;
}

interface Ctx {
  users: Map<string, { name: string; email: string | null }>;
  admissions: Map<string, { name: string; detail: string | null; deleted: boolean }>;
  requests: Map<string, { title: string; code: string | null }>;
  jobs: Map<string, { title: string; code: string | null }>;
  applications: Map<string, { name: string; jobId: string | null; jobTitle: string | null }>;
  appStages: Map<string, string>;
}

/** Remove caracteres que quebram a sintaxe do filtro `or` do PostgREST. */
function safeTerm(q: string): string {
  return q.replace(/[,()*%\\"'.:]/g, " ").replace(/\s+/g, " ").trim();
}

function sinceIso(period: ActivityPeriod): string | null {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : null;
  return days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
}

function inList(col: string, ids: string[]): string | null {
  const clean = ids.filter((i) => SAFE_ID.test(i));
  return clean.length ? `${col}.in.(${clean.join(",")})` : null;
}

export async function loadActivityPage(
  supabase: SupabaseClient,
  filters: ActivityFilters,
  cursor: ActivityCursor | null,
  pageSize = ACTIVITY_PAGE_SIZE
): Promise<{ items: ActivityItem[]; nextCursor: ActivityCursor | null }> {
  const skip = new Set(cursor?.skip ?? []);
  const limit = pageSize + 1 + skip.size;
  const since = sinceIso(filters.period);
  const cat = filters.category || null;
  const term = safeTerm(filters.q);
  const searching = term.length >= 2;
  const scopedToAdmissions = !!(filters.company || filters.branch);

  // ── Pré-consultas: filtro de usuário, busca e escopo empresa/filial ──
  let userName: string | null = null;
  if (filters.user) {
    const { data } = await supabase.from("users").select("name").eq("id", filters.user).maybeSingle();
    userName = (data as { name?: string } | null)?.name ?? null;
  }

  let scopedAdmissionIds: string[] | null = null;
  if (scopedToAdmissions) {
    let q = supabase.from("admissions").select("id").limit(2000);
    if (filters.company) q = q.eq("companyId", filters.company);
    if (filters.branch) q = q.eq("branchId", filters.branch);
    const { data } = await q;
    scopedAdmissionIds = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  }

  const search = searching
    ? await (async () => {
        const like = `%${term}%`;
        const [adm, usr, req, job, app] = await Promise.all([
          supabase.from("admissions").select("id").ilike("fullName", like).limit(100),
          supabase.from("users").select("id").ilike("name", like).limit(50),
          supabase.from("job_requests").select("id").or(`title.ilike.*${term}*,code.ilike.*${term}*,requester_name.ilike.*${term}*`).limit(100),
          supabase.from("jobs").select("id").or(`title.ilike.*${term}*,code.ilike.*${term}*`).limit(100),
          supabase.from("applications").select("id").ilike("fullName", like).limit(100),
        ]);
        // Listas curtas: os ids viajam na URL do PostgREST (filtro in.(...)).
        const ids = (r: { data: unknown }) => ((r.data ?? []) as Array<{ id: string }>).map((x) => x.id);
        return { admissions: ids(adm), users: ids(usr), requests: ids(req), jobs: ids(job), applications: ids(app) };
      })()
    : null;

  // Cláusula OR montada a partir de partes opcionais; null = fonte sem resultado possível.
  const orOf = (parts: Array<string | null>): string | null | undefined => {
    if (!searching) return undefined;
    const valid = parts.filter(Boolean) as string[];
    return valid.length ? valid.join(",") : null;
  };

  const queries: Array<Promise<RawRow[]>> = [];
  const wants = (c: ActivityCategory) => !cat || cat === c;

  // 1) Admissões criadas
  if (wants("admissoes")) {
    const or = orOf([`fullName.ilike.*${term}*`, inList("createdById", search?.users ?? [])]);
    if (or !== null) {
      queries.push(
        (async () => {
          let q = supabase.from("admissions").select("id, createdAt, createdById").order("createdAt", { ascending: false }).limit(limit);
          if (cursor) q = q.lte("createdAt", cursor.before);
          if (since) q = q.gte("createdAt", since);
          if (filters.user) q = q.eq("createdById", filters.user);
          if (filters.company) q = q.eq("companyId", filters.company);
          if (filters.branch) q = q.eq("branchId", filters.branch);
          if (or) q = q.or(or);
          const { data } = await q;
          return ((data ?? []) as Array<{ id: string; createdAt: string; createdById: string | null }>).map((r) => ({
            id: `adm-${r.id}`,
            at: r.createdAt,
            sortKey: timestampSortKey(r.createdAt),
            build: (ctx) => ({
              id: `adm-${r.id}`,
              at: r.createdAt,
              type: "admission.created",
              title: null,
              actor: actorOf(ctx, r.createdById),
              subject: admissionSubject(ctx, r.id),
              summary: null,
              change: null,
              changes: [],
              details: [],
              source: { table: "admissions", id: r.id, code: "CREATED" },
            }),
          }));
        })()
      );
    }
  }

  // 2) admission_activity_log (etapas, edições, ASO, formulário, documentos, usuários)
  const logActions = logActionsFor(cat);
  if (logActions.length) {
    const or = orOf([
      inList("admissionId", search?.admissions ?? []),
      inList("userId", search?.users ?? []),
      inList("entityId", search?.users ?? []),
    ]);
    const scopeEmpty = scopedAdmissionIds !== null && scopedAdmissionIds.length === 0;
    if (or !== null && !scopeEmpty) {
      queries.push(
        (async () => {
          let q = supabase
            .from("admission_activity_log")
            .select("id, userId, admissionId, entity, entityId, action, description, metadata, createdAt")
            .in("action", logActions)
            .order("createdAt", { ascending: false })
            .limit(limit);
          if (cursor) q = q.lte("createdAt", cursor.before);
          if (since) q = q.gte("createdAt", since);
          if (filters.user) q = q.eq("userId", filters.user);
          if (scopedAdmissionIds) q = q.in("admissionId", scopedAdmissionIds.slice(0, 200));
          if (or) q = q.or(or);
          const { data } = await q;
          return ((data ?? []) as Array<{
            id: number | string;
            userId: string | null;
            admissionId: string | null;
            entity: string;
            entityId: string | null;
            action: string;
            description: string | null;
            metadata: Record<string, unknown> | null;
            createdAt: string;
          }>).map((r) => {
            const id = `log-${r.id}`;
            return {
              id,
              at: r.createdAt,
              sortKey: timestampSortKey(r.createdAt),
              build: (ctx: Ctx) => {
                const meta = r.metadata ?? {};
                const type = ADMISSION_LOG_ACTIONS[r.action] ?? "admission.updated";
                const isUser = r.entity === "USER";
                const from = typeof meta.from === "string" ? meta.from : null;
                const to = typeof meta.to === "string" ? meta.to : null;
                const subjectName = typeof meta.subjectName === "string" ? meta.subjectName : null;
                let subject: ActivityItem["subject"];
                if (isUser) {
                  const u = r.entityId ? ctx.users.get(r.entityId) : undefined;
                  subject = {
                    name: u?.name ?? subjectName ?? "Usuário removido",
                    detail: u?.email ?? (typeof meta.email === "string" ? meta.email : null),
                    href: u && r.entityId ? `/usuarios/${r.entityId}/editar` : null,
                  };
                } else if (r.admissionId) {
                  subject = admissionSubject(ctx, r.admissionId, subjectName);
                } else {
                  subject = { name: subjectName ?? "—", detail: null, href: null };
                }
                const actor =
                  r.userId
                    ? actorOf(ctx, r.userId)
                    : r.action === "FORM_SUBMITTED" || r.action === "ADMISSION_DIGITAL_COMPLETE"
                      ? { id: null, name: "Candidato" }
                      : r.action === "DIGITAL_ADMISSION_STARTED"
                        ? { id: null, name: "Assistente do WhatsApp" }
                        : { id: null, name: "Sistema" };
                return {
                  id,
                  at: r.createdAt,
                  type,
                  title: null,
                  actor,
                  subject,
                  summary: r.description,
                  change: from && to ? { from, to } : null,
                  changes: Array.isArray(meta.changes) ? (meta.changes as FieldChangeMeta[]) : [],
                  details: [],
                  source: { table: "admission_activity_log", id: String(r.id), code: r.action },
                };
              },
            };
          });
        })()
      );
    }
  }

  // As demais fontes não têm empresa/filial de admissão: ficam de fora quando esse escopo é usado.
  if (!scopedToAdmissions) {
    // 3) Solicitações de vaga
    if (wants("solicitacoes")) {
      const or = orOf([
        inList("request_id", search?.requests ?? []),
        inList("actor_user_id", search?.users ?? []),
        `actor_name.ilike.*${term}*`,
      ]);
      if (or !== null) {
        queries.push(
          (async () => {
            let q = supabase
              .from("job_request_history")
              .select("id, request_id, event, from_status, to_status, comment, actor_user_id, actor_name, created_at")
              .order("created_at", { ascending: false })
              .limit(limit);
            if (cursor) q = q.lte("created_at", cursor.before);
            if (since) q = q.gte("created_at", since);
            if (filters.user) q = q.eq("actor_user_id", filters.user);
            if (or) q = q.or(or);
            const { data } = await q;
            return ((data ?? []) as Array<{
              id: string;
              request_id: string;
              event: string;
              from_status: string | null;
              to_status: string | null;
              comment: string | null;
              actor_user_id: string | null;
              actor_name: string | null;
              created_at: string;
            }>).map((r) => ({
              id: `jrh-${r.id}`,
              at: r.created_at,
              sortKey: timestampSortKey(r.created_at),
              build: (ctx: Ctx) => {
                const req = ctx.requests.get(r.request_id);
                const label = (s: string | null) => (s ? (JOB_REQUEST_STATUS_LABELS as Record<string, string>)[s] ?? s : null);
                const from = label(r.from_status);
                const to = label(r.to_status);
                return {
                  id: `jrh-${r.id}`,
                  at: r.created_at,
                  type: requestEventType(r.event),
                  title: null,
                  actor: r.actor_user_id ? actorOf(ctx, r.actor_user_id, r.actor_name) : { id: null, name: r.actor_name ?? "Sistema" },
                  subject: {
                    name: req?.title ?? "Solicitação de vaga",
                    detail: req?.code ?? null,
                    href: `/solicitacoes/${r.request_id}`,
                  },
                  summary: r.comment,
                  change: from && to && from !== to ? { from, to } : null,
                  changes: [],
                  details: [],
                  source: { table: "job_request_history", id: r.id, code: r.event },
                };
              },
            }));
          })()
        );
      }
    }

    // 4) Vagas: eventos (posições, campos) e mudanças de status
    if (wants("vagas")) {
      const orEvents = orOf([inList("jobId", search?.jobs ?? []), `actorName.ilike.*${term}*`]);
      if (orEvents !== null) {
        queries.push(
          (async () => {
            let q = supabase
              .from("job_events")
              .select("id, jobId, positionId, type, reason, data, actorUserId, actorName, createdAt")
              .not("type", "in", `(${HIDDEN_JOB_EVENTS.join(",")})`)
              .order("createdAt", { ascending: false })
              .limit(limit);
            if (cursor) q = q.lte("createdAt", cursor.before);
            if (since) q = q.gte("createdAt", since);
            if (filters.user) q = q.eq("actorUserId", filters.user);
            if (orEvents) q = q.or(orEvents);
            const { data } = await q;
            return ((data ?? []) as Array<{
              id: string;
              jobId: string;
              positionId: string | null;
              type: string;
              reason: string | null;
              data: Record<string, unknown>;
              actorUserId: string | null;
              actorName: string;
              createdAt: string;
            }>).map((r) => ({
              id: `jev-${r.id}`,
              at: r.createdAt,
              sortKey: timestampSortKey(r.createdAt),
              build: (ctx: Ctx) => {
                const h = jobEventItem({ ...r, data: r.data ?? {} });
                return {
                  id: `jev-${r.id}`,
                  at: r.createdAt,
                  type: "job.event",
                  title: h?.title ?? "Vaga atualizada",
                  actor: r.actorUserId ? actorOf(ctx, r.actorUserId, r.actorName) : { id: null, name: r.actorName || "Sistema" },
                  subject: jobSubject(ctx, r.jobId),
                  summary: null,
                  change: null,
                  changes: [],
                  details: h?.details ?? [],
                  source: { table: "job_events", id: r.id, code: r.type },
                };
              },
            }));
          })()
        );
      }
      const orStatus = orOf([inList("jobId", search?.jobs ?? []), `changedBy.ilike.*${term}*`]);
      if (orStatus !== null && (!filters.user || userName)) {
        queries.push(
          (async () => {
            let q = supabase
              .from("job_status_history")
              .select("id, jobId, status, changedBy, changedAt")
              .order("changedAt", { ascending: false })
              .limit(limit);
            if (cursor) q = q.lte("changedAt", cursor.before);
            if (since) q = q.gte("changedAt", since);
            if (userName) q = q.eq("changedBy", userName);
            if (orStatus) q = q.or(orStatus);
            const { data } = await q;
            return ((data ?? []) as Array<{ id: string; jobId: string; status: string; changedBy: string; changedAt: string }>).map((r) => ({
              id: `jsh-${r.id}`,
              at: r.changedAt,
              sortKey: timestampSortKey(r.changedAt),
              build: (ctx: Ctx) => {
                return {
                  id: `jsh-${r.id}`,
                  at: r.changedAt,
                  type: "job.status",
                  title: jobStatusTitle(r.status),
                  actor: actorByName(ctx, r.changedBy),
                  subject: jobSubject(ctx, r.jobId),
                  summary: null,
                  change: null,
                  changes: [],
                  details: [],
                  source: { table: "job_status_history", id: r.id, code: r.status },
                };
              },
            }));
          })()
        );
      }
    }

    // 5) Candidatos movidos no funil
    if (wants("candidatos") && (!filters.user || userName)) {
      const or = orOf([inList("applicationId", search?.applications ?? []), `changedBy.ilike.*${term}*`]);
      if (or !== null) {
        queries.push(
          (async () => {
            let q = supabase
              .from("application_stage_history")
              .select("id, applicationId, stageId, changedBy, changedAt")
              .order("changedAt", { ascending: false })
              .limit(limit);
            if (cursor) q = q.lte("changedAt", cursor.before);
            if (since) q = q.gte("changedAt", since);
            if (userName) q = q.eq("changedBy", userName);
            if (or) q = q.or(or);
            const { data } = await q;
            return ((data ?? []) as Array<{ id: string; applicationId: string; stageId: string | null; changedBy: string; changedAt: string }>).map(
              (r) => ({
                id: `ash-${r.id}`,
                at: r.changedAt,
                sortKey: timestampSortKey(r.changedAt),
                build: (ctx: Ctx) => {
                  const app = ctx.applications.get(r.applicationId);
                  const stage = r.stageId ? (ctx.appStages.get(r.stageId) ?? r.stageId) : null;
                  return {
                    id: `ash-${r.id}`,
                    at: r.changedAt,
                    type: "candidate.stage_changed",
                    title: stage ? `Movido para ${stage}` : null,
                    actor: actorByName(ctx, r.changedBy),
                    subject: {
                      name: app?.name ?? "Candidato",
                      detail: app?.jobTitle ?? null,
                      href: app?.jobId ? `/vagas/${app.jobId}/candidatos` : null,
                    },
                    summary: null,
                    change: null,
                    changes: [],
                    details: stage ? [`Etapa: ${stage}`] : [],
                    source: { table: "application_stage_history", id: r.id, code: r.stageId ?? "" },
                  };
                },
              })
            );
          })()
        );
      }
    }

    // 6) Configurações
    if (wants("configuracoes")) {
      const or = orOf([`actorName.ilike.*${term}*`, `summary.ilike.*${term}*`]);
      if (or !== null) {
        queries.push(
          (async () => {
            let q = supabase
              .from("config_change_log")
              .select("id, module, summary, actorId, actorName, createdAt")
              .order("createdAt", { ascending: false })
              .limit(limit);
            if (cursor) q = q.lte("createdAt", cursor.before);
            if (since) q = q.gte("createdAt", since);
            if (filters.user) q = q.eq("actorId", filters.user);
            if (or) q = q.or(or);
            const { data } = await q;
            return ((data ?? []) as Array<{ id: string; module: string; summary: string; actorId: string; actorName: string; createdAt: string }>).map(
              (r) => ({
                id: `cfg-${r.id}`,
                at: r.createdAt,
                sortKey: timestampSortKey(r.createdAt),
                build: (ctx: Ctx) => ({
                  id: `cfg-${r.id}`,
                  at: r.createdAt,
                  type: "settings.changed",
                  title: null,
                  actor: actorOf(ctx, r.actorId, r.actorName),
                  subject: { name: moduleLabel(r.module), detail: "Configurações", href: "/configuracoes" },
                  summary: r.summary,
                  change: null,
                  changes: [],
                  details: [],
                  source: { table: "config_change_log", id: r.id, code: r.module },
                }),
              })
            );
          })()
        );
      }
    }
  }

  // ── Merge ──
  const all = (await Promise.all(queries)).flat().filter((r) => !skip.has(r.id));
  all.sort((a, b) => (a.sortKey === b.sortKey ? b.id.localeCompare(a.id) : b.sortKey.localeCompare(a.sortKey)));
  const page = all.slice(0, pageSize);
  const hasMore = all.length > pageSize;

  const ctx = await loadContext(supabase, page);
  const items = page.map((r) => r.build(ctx));

  let nextCursor: ActivityCursor | null = null;
  if (hasMore && page.length) {
    const last = page[page.length - 1];
    const sameInstant = page.filter((r) => r.sortKey === last.sortKey).map((r) => r.id);
    const carried = cursor && timestampSortKey(cursor.before) === last.sortKey ? cursor.skip : [];
    nextCursor = { before: last.at, skip: [...new Set([...carried, ...sameInstant])] };
  }
  return { items, nextCursor };
}

// ─── Enriquecimento (só os itens da página) ──────────────────────────────────

async function loadContext(supabase: SupabaseClient, page: RawRow[]): Promise<Ctx> {
  // Os builders leem o contexto; aqui descobrimos o que cada um precisa rodando-os
  // num contexto "espião" que registra as chaves pedidas.
  const need = { users: new Set<string>(), admissions: new Set<string>(), requests: new Set<string>(), jobs: new Set<string>(), applications: new Set<string>(), stages: new Set<string>() };
  const spy = (bucket: Set<string>) =>
    new Proxy(new Map(), {
      get(target, prop) {
        if (prop === "get") return (k: string) => (bucket.add(k), undefined);
        return Reflect.get(target, prop);
      },
    });
  const spyCtx: Ctx = {
    users: spy(need.users),
    admissions: spy(need.admissions),
    requests: spy(need.requests),
    jobs: spy(need.jobs),
    applications: spy(need.applications),
    appStages: spy(need.stages),
  };
  for (const r of page) r.build(spyCtx);

  const ids = (s: Set<string>) => [...s].filter((i) => SAFE_ID.test(i));
  const [usersRes, admRes, reqRes, jobRes, appRes, stageRes] = await Promise.all([
    need.users.size ? supabase.from("users").select("id, name, email").in("id", ids(need.users)) : null,
    need.admissions.size
      ? supabase
          .from("admissions")
          .select("id, fullName, deletedAt, position:admission_positions(name), branch:admission_branches(name), company:admission_companies(name)")
          .in("id", ids(need.admissions))
      : null,
    need.requests.size ? supabase.from("job_requests").select("id, title, code").in("id", ids(need.requests)) : null,
    need.jobs.size ? supabase.from("jobs").select("id, title, code").in("id", ids(need.jobs)) : null,
    need.applications.size
      ? supabase.from("applications").select("id, fullName, jobId, job:jobs(title)").in("id", ids(need.applications))
      : null,
    need.stages.size ? supabase.from("application_stages").select("id, name").in("id", ids(need.stages)) : null,
  ]);

  const ctx: Ctx = {
    users: new Map(((usersRes?.data ?? []) as Array<{ id: string; name: string; email: string | null }>).map((u) => [u.id, { name: u.name, email: u.email }])),
    admissions: new Map(
      ((admRes?.data ?? []) as unknown as Array<{
        id: string;
        fullName: string;
        deletedAt: string | null;
        position: { name: string } | null;
        branch: { name: string } | null;
        company: { name: string } | null;
      }>).map((a) => [
        a.id,
        {
          name: a.fullName,
          detail: [a.position?.name, a.branch?.name ?? a.company?.name].filter(Boolean).join(" · ") || null,
          deleted: !!a.deletedAt,
        },
      ])
    ),
    requests: new Map(((reqRes?.data ?? []) as Array<{ id: string; title: string; code: string | null }>).map((r) => [r.id, { title: r.title, code: r.code }])),
    jobs: new Map(((jobRes?.data ?? []) as Array<{ id: string; title: string; code: string | null }>).map((j) => [j.id, { title: j.title, code: j.code }])),
    applications: new Map(
      ((appRes?.data ?? []) as unknown as Array<{ id: string; fullName: string; jobId: string | null; job: { title: string } | null }>).map((a) => [
        a.id,
        { name: a.fullName, jobId: a.jobId, jobTitle: a.job?.title ?? null },
      ])
    ),
    appStages: new Map(((stageRes?.data ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name])),
  };
  return ctx;
}

function actorOf(ctx: Ctx, id: string | null, fallbackName?: string | null): ActivityItem["actor"] {
  if (!id) return { id: null, name: fallbackName || "Sistema" };
  return { id, name: ctx.users.get(id)?.name ?? fallbackName ?? "Usuário removido" };
}

function actorByName(_ctx: Ctx, name: string | null): ActivityItem["actor"] {
  return { id: null, name: name || "Sistema" };
}

function admissionSubject(ctx: Ctx, id: string, fallbackName?: string | null): ActivityItem["subject"] {
  const a = ctx.admissions.get(id);
  if (!a) return { name: fallbackName ?? "Admissão", detail: null, href: null };
  return { name: a.name, detail: a.deleted ? "Admissão excluída" : a.detail, href: a.deleted ? null : `/admissoes/${id}` };
}

function jobSubject(ctx: Ctx, jobId: string): ActivityItem["subject"] {
  const j = ctx.jobs.get(jobId);
  return { name: j?.title ?? "Vaga", detail: j?.code ?? null, href: `/vagas/${jobId}/editar?tab=historico` };
}

/** Título pelo status de destino (o registro não guarda o status anterior). */
function jobStatusTitle(status: string): string {
  if (status === "PAUSED") return "Vaga pausada";
  if (status === "FILLED") return "Vaga encerrada";
  if (status === "CLOSED") return "Vaga cancelada";
  return `Status alterado para ${JOB_PROCESS_STATUS_LABELS[status] ?? status}`;
}

const MODULE_LABELS: Record<string, string> = {
  funil: "Funil de seleção",
  homepage: "Página de carreiras",
  cadastros: "Cadastros",
};

function moduleLabel(module: string): string {
  const [root, sub] = module.split(".");
  const base = MODULE_LABELS[root] ?? root.charAt(0).toUpperCase() + root.slice(1);
  return sub ? `${base} · ${sub}` : base;
}
