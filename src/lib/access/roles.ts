// Perfis e permissões de acesso ao painel — módulo PURO (servidor e cliente).
//
// Modelo: PERFIL (users.role, espelhado no JWT como app_metadata.user_role) + PERMISSÕES
// ADICIONAIS (flags na tabela users). Hoje o banco conhece dois perfis e uma flag:
//
//   ADMIN_RH  → is_admin() nas policies RLS: escreve em tudo.
//   VIEWER_RH → is_staff(): só leitura.
//   isApprover (flag) → decide solicitações de vaga encaminhadas a ele, em qualquer perfil.
//
// Os perfis "Analista RH" e "Aprovador" estão DESCRITOS aqui para a próxima etapa, mas
// não são atribuíveis: ativar um papel novo exige migração (enum UserRole + funções
// is_admin/is_staff/is_analyst nas policies) — senão o usuário entraria sem nenhuma
// permissão de escrita ou, pior, sem leitura. O "Aprovador" já existe na prática como
// Visualizador + permissão "Aprovar solicitações de vaga".

export type RoleKey = "ADMIN_RH" | "ANALYST_RH" | "APPROVER" | "VIEWER_RH";

export type PermissionKey =
  | "operate"
  | "approve_requests"
  | "export_data"
  | "manage_users"
  | "edit_settings";

export const PERMISSIONS: Record<PermissionKey, { label: string; description: string }> = {
  operate: {
    label: "Operar recrutamento e admissões",
    description: "Criar e editar vagas, mover candidatos, conduzir admissões e validar documentos.",
  },
  approve_requests: {
    label: "Aprovar solicitações de vaga",
    description: "Aprovar, reprovar ou devolver as solicitações encaminhadas a ele.",
  },
  export_data: {
    label: "Exportar dados",
    description: "Baixar planilhas de admissões e relatórios.",
  },
  manage_users: {
    label: "Gerenciar usuários",
    description: "Criar contas, alterar perfis e desativar acessos.",
  },
  edit_settings: {
    label: "Editar configurações",
    description: "Funil, cadastros, formulários e modelos do portal.",
  },
};

export interface RoleProfile {
  key: RoleKey;
  label: string;
  /** Rótulo curto para badges e tabelas. */
  short: string;
  description: string;
  /** Permissões que o perfil concede por si só. */
  grants: PermissionKey[];
  /** Pode ser atribuído hoje (existe no banco e nas policies)? */
  assignable: boolean;
  /** Valor gravado em users.role quando atribuível. */
  dbRole: "ADMIN_RH" | "VIEWER_RH" | null;
}

export const ROLE_PROFILES: RoleProfile[] = [
  {
    key: "ADMIN_RH",
    label: "Administrador RH",
    short: "Admin RH",
    description: "Acesso administrativo completo: opera todos os módulos, gerencia usuários e configurações.",
    grants: ["operate", "approve_requests", "export_data", "manage_users", "edit_settings"],
    assignable: true,
    dbRole: "ADMIN_RH",
  },
  {
    key: "ANALYST_RH",
    label: "Analista RH",
    short: "Analista RH",
    description: "Opera recrutamento, seleção e admissões, sem administrar usuários nem configurações críticas.",
    grants: ["operate", "export_data"],
    assignable: false,
    dbRole: null,
  },
  {
    key: "APPROVER",
    label: "Aprovador",
    short: "Aprovador",
    description: "Consulta o portal e decide as solicitações de vaga do seu fluxo.",
    grants: ["approve_requests", "export_data"],
    assignable: false,
    dbRole: null,
  },
  {
    key: "VIEWER_RH",
    label: "Visualizador",
    short: "Visualizador",
    description: "Somente leitura das áreas do painel. Pode exportar planilhas.",
    grants: ["export_data"],
    assignable: true,
    dbRole: "VIEWER_RH",
  },
];

export function roleProfile(role: string | null | undefined): RoleProfile {
  return ROLE_PROFILES.find((p) => p.key === role) ?? ROLE_PROFILES[ROLE_PROFILES.length - 1];
}

export function roleLabel(role: string | null | undefined): string {
  return roleProfile(role).label;
}

export interface AccessSubject {
  role: string;
  isApprover?: boolean | null;
}

/** Permissões efetivas: as do perfil + as adicionais marcadas no usuário. */
export function effectivePermissions(u: AccessSubject): PermissionKey[] {
  const set = new Set(roleProfile(u.role).grants);
  if (u.isApprover) set.add("approve_requests");
  return (Object.keys(PERMISSIONS) as PermissionKey[]).filter((k) => set.has(k));
}

/**
 * Permissões ADICIONAIS (além do que o perfil já dá) — é o que a coluna "Permissões"
 * mostra. Admin com isApprover aparece como "Aprovador padrão": entra primeiro na lista
 * de aprovadores das solicitações.
 */
export function extraPermissions(u: AccessSubject): Array<{ key: PermissionKey | "default_approver"; label: string }> {
  if (!u.isApprover) return [];
  if (roleProfile(u.role).grants.includes("approve_requests")) {
    return [{ key: "default_approver", label: "Aprovador padrão" }];
  }
  return [{ key: "approve_requests", label: "Aprova solicitações" }];
}

/** Rótulo do acesso completo, para a frase de confirmação ("Visualizador + aprovação"). */
export function accessLabel(u: AccessSubject): string {
  const base = roleProfile(u.role).short;
  const extra = extraPermissions(u).map((e) => e.label.toLowerCase());
  return extra.length ? `${base} (${extra.join(", ")})` : base;
}

/** O que muda ao trocar o acesso: permissões ganhas e perdidas, em linguagem de negócio. */
export function describeAccessChange(from: AccessSubject, to: AccessSubject): { gained: string[]; lost: string[] } {
  const a = new Set(effectivePermissions(from));
  const b = new Set(effectivePermissions(to));
  return {
    gained: [...b].filter((k) => !a.has(k)).map((k) => PERMISSIONS[k].label),
    lost: [...a].filter((k) => !b.has(k)).map((k) => PERMISSIONS[k].label),
  };
}
