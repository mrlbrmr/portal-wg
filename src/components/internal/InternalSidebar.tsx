"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Settings,
  Users,
  UserCircle,
  ClipboardCheck,
  List,
  Kanban,
  Calendar,
  BarChart3,
  History,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  BookOpen,
  Star,
} from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/lib/utils";

interface Props {
  role: string;
  name?: string | null;
  onNavClick?: () => void;
}

interface NavLink {
  href: string;
  label: string;
  icon: ElementType;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function InternalSidebar({ role, name, onNavClick }: Props) {
  const pathname = usePathname();
  const isAdmin = role === "ADMIN_RH";

  const topLinks: NavLink[] = [
    { href: "/dashboard",      label: "Dashboard", icon: LayoutDashboard },
    { href: "/vagas/gerenciar", label: "Vagas",     icon: Briefcase },
    { href: "/talentos",       label: "Talentos",  icon: Star },
  ];

  const admissaoSub: NavLink[] = [
    { href: "/admissoes", label: "Lista", icon: List },
    { href: "/admissoes/kanban", label: "Kanban", icon: Kanban },
    { href: "/admissoes/calendario", label: "Calendário", icon: Calendar },
    { href: "/admissoes/relatorios", label: "Relatórios", icon: BarChart3 },
    { href: "/admissoes/historico", label: "Histórico", icon: History },
    ...(isAdmin
      ? [{ href: "/admissoes/configuracoes", label: "Configurações", icon: Settings }]
      : []),
  ];

  const systemLinks: NavLink[] = isAdmin
    ? [
        { href: "/usuarios", label: "Usuários", icon: Users },
        { href: "/configuracoes", label: "Configurações", icon: Settings },
      ]
    : [];

  const perfilLink: NavLink = { href: "/perfil", label: "Meu Perfil", icon: UserCircle };

  const admissaoActive = pathname === "/admissoes" || pathname.startsWith("/admissoes/");
  const avaliacoesActive = pathname.startsWith("/avaliacoes");

  const avaliacoesSub: NavLink[] = [
    { href: "/avaliacoes/banco", label: "Banco de Testes", icon: BookOpen },
    { href: "/avaliacoes/resultados", label: "Resultados", icon: BarChart3 },
  ];

  function itemClass(active: boolean, sub = false) {
    return cn(
      "flex items-center gap-2.5 py-2.5 rounded-[10px] text-sm transition-colors",
      sub ? "px-3 text-[13px]" : "px-3",
      active
        ? "bg-white text-wg-ink font-bold shadow-[0_1px_3px_rgba(0,0,0,.06)] border-l-[3px] border-wg-green"
        : "text-wg-ink-secondary font-medium hover:bg-wg-hover-light"
    );
  }

  function renderLink(link: NavLink, exact = false, sub = false) {
    const active = exact
      ? pathname === link.href
      : pathname === link.href || pathname.startsWith(link.href + "/");
    return (
      <Link key={link.href} href={link.href} onClick={onNavClick} className={itemClass(active, sub)}>
        <link.icon className="w-4 h-4 shrink-0" />
        {link.label}
      </Link>
    );
  }

  const roleLabel = role === "ADMIN_RH" ? "Admin RH" : "Visualizador";

  return (
    <aside className="w-[232px] bg-wg-sidebar border-r border-wg-border-light h-full min-h-[calc(100vh-56px)] overflow-y-auto px-4 py-5 flex-shrink-0 flex flex-col">
      <nav className="flex flex-col gap-0.5 flex-1">
        <p className="text-wg-ink-muted text-[10.5px] tracking-[.08em] uppercase font-semibold px-2.5 pt-1 pb-2">
          Recrutamento
        </p>

        {topLinks.map((l) => renderLink(l))}

        {/* Avaliações */}
        <Link
          href="/avaliacoes/banco"
          onClick={onNavClick}
          className={itemClass(avaliacoesActive)}
          aria-expanded={avaliacoesActive}
        >
          <FlaskConical className="w-4 h-4 shrink-0" />
          <span className="flex-1">Avaliações</span>
          {avaliacoesActive
            ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
            : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
          }
        </Link>
        {avaliacoesActive && (
          <div className="ml-3 flex flex-col gap-0.5 border-l border-wg-border-light pl-2">
            {avaliacoesSub.map((l) => renderLink(l, false, true))}
          </div>
        )}

        {/* ── Admissões ───────────────────────────────── */}
        <p className="text-wg-ink-muted text-[10.5px] tracking-[.08em] uppercase font-semibold px-2.5 pt-4 pb-2">
          Admissões
        </p>

        <Link
          href="/admissoes"
          onClick={onNavClick}
          className={itemClass(admissaoActive)}
          aria-expanded={admissaoActive}
        >
          <ClipboardCheck className="w-4 h-4 shrink-0" />
          <span className="flex-1">Admissões</span>
          {admissaoActive
            ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
            : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
          }
        </Link>
        {admissaoActive && (
          <div className="ml-3 flex flex-col gap-0.5 border-l border-wg-border-light pl-2">
            {admissaoSub.map((l) => renderLink(l, l.href === "/admissoes", true))}
          </div>
        )}

        {/* ── Sistema ─────────────────────────────────── */}
        <p className="text-wg-ink-muted text-[10.5px] tracking-[.08em] uppercase font-semibold px-2.5 pt-4 pb-2">
          Sistema
        </p>
        {systemLinks.map((l) => renderLink(l))}
        {renderLink(perfilLink)}
      </nav>

      {/* User info */}
      <div className="mt-4 pt-4 border-t border-wg-border-light flex items-center gap-2.5 px-1">
        <div className="w-[30px] h-[30px] rounded-full bg-wg-green-dark text-white flex items-center justify-center text-[12px] font-bold shrink-0">
          {initials(name)}
        </div>
        <div className="min-w-0">
          <div className="text-wg-ink text-[13px] font-semibold truncate">{name ?? "Usuário"}</div>
          <div className="text-wg-ink-muted text-[11px]">{roleLabel}</div>
        </div>
      </div>
    </aside>
  );
}
