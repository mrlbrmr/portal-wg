"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants, Button } from "@/components/ui/Button";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { FilterBar, FilterSelect, SearchField } from "@/components/ui/FilterControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useToast } from "@/components/ui/ToastProvider";
import { rowClass, tableScroll, tableShell, tdClass, thClass } from "@/components/ui/table";
import { effectivePermissions, extraPermissions, PERMISSIONS, roleProfile } from "@/lib/access/roles";
import { ChangeAccessDialog, type AccessTarget } from "./ChangeAccessDialog";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isApprover: boolean;
  active: boolean;
  createdAt: string;
  /** Último login (Supabase Auth). null = nunca acessou; undefined = sem credencial encontrada. */
  lastSignInAt: string | null | undefined;
}

const TZ = "America/Sao_Paulo";

function lastAccessLabel(iso: string | null | undefined, available: boolean, now = new Date()): string {
  if (!available) return "—";
  if (iso === undefined) return "Sem credencial";
  if (!iso) return "Nunca acessou";
  const d = new Date(iso);
  const key = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  if (key(d) === key(now)) return `Hoje, ${time}`;
  if (key(d) === key(new Date(now.getTime() - 86_400_000))) return `Ontem, ${time}`;
  return d.toLocaleDateString("pt-BR", { timeZone: TZ });
}

type StatusFilter = "" | "ativos" | "desativados";

export function UsersTable({
  users,
  currentUserId,
  signInsAvailable,
}: {
  users: UserRow[];
  currentUserId: string;
  /** false quando o Supabase Auth não respondeu — último acesso fica "—". */
  signInsAvailable: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [profile, setProfile] = useState("");
  const [accessTarget, setAccessTarget] = useState<AccessTarget | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
        (!status || (status === "ativos" ? u.active : !u.active)) &&
        (!profile || (profile === "APPROVER" ? u.isApprover : u.role === profile))
    );
  }, [users, query, status, profile]);

  async function setActive(u: UserRow, active: boolean) {
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        notify("error", typeof d.error === "string" ? d.error : "Não foi possível atualizar o usuário.");
        return;
      }
      notify("success", active ? `${u.name} foi reativado(a).` : `${u.name} foi desativado(a) e não consegue mais entrar.`);
      router.refresh();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  function menuFor(u: UserRow): DropdownMenuItem[] {
    if (u.id === currentUserId) {
      return [{ label: "Editar meu perfil", icon: Pencil, href: "/perfil" }];
    }
    return [
      { label: "Editar usuário", icon: Pencil, href: `/usuarios/${u.id}/editar` },
      {
        label: "Alterar perfil",
        icon: ShieldCheck,
        onSelect: () => setAccessTarget({ id: u.id, name: u.name, email: u.email, role: u.role, isApprover: u.isApprover }),
      },
      { type: "separator" },
      u.active
        ? { label: "Desativar usuário", icon: UserX, danger: true, onSelect: () => setConfirmDeactivate(u) }
        : { label: "Reativar usuário", icon: UserCheck, onSelect: () => setActive(u, true) },
    ];
  }

  const activeFilters = [query.trim(), status, profile].filter(Boolean).length;
  const clear = () => {
    setQuery("");
    setStatus("");
    setProfile("");
  };

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        activeCount={activeFilters}
        onClear={clear}
        search={<SearchField value={query} onChange={setQuery} placeholder="Buscar por nome ou e-mail..." className="max-w-md" />}
        trailing={
          <span className="text-meta tabular-nums text-wg-ink-muted">
            {rows.length} de {users.length}
          </span>
        }
      >
        <FilterSelect
          label="Perfil"
          value={profile}
          onChange={setProfile}
          options={[
            { value: "", label: "Todos" },
            { value: "ADMIN_RH", label: "Administrador RH" },
            { value: "VIEWER_RH", label: "Visualizador" },
            { value: "APPROVER", label: "Aprova solicitações" },
          ]}
        />
        <FilterSelect<StatusFilter>
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "Todos" },
            { value: "ativos", label: "Ativos" },
            { value: "desativados", label: "Desativados" },
          ]}
        />
      </FilterBar>

      <div className={tableShell}>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={users.length === 0 ? "Nenhum usuário cadastrado." : "Nenhum usuário encontrado."}
            description={users.length === 0 ? "Crie a primeira conta de acesso ao portal." : "Ajuste a busca ou os filtros."}
            action={
              activeFilters > 0 ? (
                <Button variant="secondary" size="sm" onClick={clear}>
                  Limpar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={tableScroll}>
            <table className="w-full min-w-[880px] text-body">
              <thead className="border-b border-wg-border-lighter bg-wg-bg/60">
                <tr>
                  <th scope="col" className={thClass}>Usuário</th>
                  <th scope="col" className={thClass}>Perfil</th>
                  <th scope="col" className={thClass}>Permissões</th>
                  <th scope="col" className={thClass}>Status</th>
                  <th scope="col" className={thClass}>Último acesso</th>
                  <th scope="col" className={cn(thClass, "w-14 text-right")}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wg-border-lighter">
                {rows.map((u) => {
                  const p = roleProfile(u.role);
                  const extras = extraPermissions(u);
                  const isMe = u.id === currentUserId;
                  const effective = effectivePermissions(u).map((k) => PERMISSIONS[k].label).join("\n");
                  return (
                    <tr key={u.id} className={cn(rowClass, !u.active && "bg-wg-bg/40")}>
                      <td className={tdClass}>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={u.name} className={!u.active ? "opacity-60" : undefined} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-semibold text-wg-ink">
                              <span className="truncate">{u.name}</span>
                              {isMe && <span className="shrink-0 text-meta font-normal text-wg-ink-muted">(você)</span>}
                            </p>
                            <p className="truncate text-meta text-wg-ink-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={tdClass}>
                        <span
                          title={`${p.description}\n\nPode:\n${effective}`}
                          className={cn(
                            "inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-semibold",
                            u.role === "ADMIN_RH" ? "bg-wg-sidebar text-wg-green-dark" : "bg-neutral-bg text-neutral-fg"
                          )}
                        >
                          {p.short}
                        </span>
                      </td>
                      <td className={tdClass}>
                        {extras.length === 0 ? (
                          <span className="text-wg-ink-muted" aria-label="Sem permissões adicionais">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {extras.map((e) => (
                              <span
                                key={e.key}
                                title={PERMISSIONS.approve_requests.description}
                                className="inline-flex h-[22px] items-center gap-1 rounded-full border border-wg-border-light bg-white px-2 text-[11.5px] font-medium text-wg-ink-secondary"
                              >
                                <ShieldCheck className="h-3 w-3" aria-hidden />
                                {e.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={tdClass}>
                        {u.active ? <StatusBadge tone="success">Ativo</StatusBadge> : <StatusBadge tone="neutral">Desativado</StatusBadge>}
                      </td>
                      <td className={cn(tdClass, "whitespace-nowrap text-meta", u.lastSignInAt ? "text-wg-ink-secondary" : "text-wg-ink-muted")}>
                        <span title={u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString("pt-BR", { timeZone: TZ }) : undefined}>
                          {lastAccessLabel(u.lastSignInAt, signInsAvailable)}
                        </span>
                      </td>
                      <td className={cn(tdClass, "text-right")}>
                        <DropdownMenu
                          portal
                          ariaLabel={`Ações de ${u.name}`}
                          title="Ações"
                          disabled={busyId === u.id}
                          trigger={<MoreHorizontal aria-hidden />}
                          triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                          items={menuFor(u)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ChangeAccessDialog
        user={accessTarget}
        onClose={() => setAccessTarget(null)}
        onSaved={(msg) => {
          setAccessTarget(null);
          notify("success", msg);
          router.refresh();
        }}
      />

      <ConfirmModal
        isOpen={!!confirmDeactivate}
        title={confirmDeactivate ? `Desativar ${confirmDeactivate.name}?` : "Desativar usuário?"}
        message="A pessoa não conseguirá mais entrar no portal. O histórico fica preservado e a conta pode ser reativada a qualquer momento."
        confirmLabel="Desativar usuário"
        variant="warning"
        onConfirm={() => {
          const u = confirmDeactivate;
          setConfirmDeactivate(null);
          if (u) setActive(u, false);
        }}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </div>
  );
}
