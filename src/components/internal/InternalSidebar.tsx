"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Plus,
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
} from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/lib/utils";

interface Props {
  role: string;
  onNavClick?: () => void;
}

interface NavLink {
  href: string;
  label: string;
  icon: ElementType;
}

export default function InternalSidebar({ role, onNavClick }: Props) {
  const pathname = usePathname();
  const isAdmin = role === "ADMIN_RH";

  const topLinks: NavLink[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/vagas/gerenciar", label: "Vagas", icon: Briefcase },
  ];

  // Submenus de Admissões — espelham o app original (Admissões, Kanban,
  // Calendário, Relatórios, Histórico, Configurações), adaptados ao portal.
  const admissaoSub: NavLink[] = [
    { href: "/admissoes", label: "Lista", icon: List },
    { href: "/admissoes/kanban", label: "Kanban", icon: Kanban },
    { href: "/admissoes/calendario", label: "Calendário", icon: Calendar },
    { href: "/admissoes/relatorios", label: "Relatórios", icon: BarChart3 },
    { href: "/admissoes/historico", label: "Histórico", icon: History },
    ...(isAdmin
      ? [
          // { href: "/admissoes/digitais", label: "Digital (WhatsApp)", icon: MessageSquare }, // módulo desativado
          { href: "/admissoes/configuracoes", label: "Configurações", icon: Settings },
        ]
      : []),
  ];

  const adminLinks: NavLink[] = isAdmin
    ? [
        { href: "/vagas/nova", label: "Nova Vaga", icon: Plus },
        { href: "/usuarios", label: "Usuários", icon: Users },
        { href: "/configuracoes", label: "Configurações", icon: Settings },
      ]
    : [];

  const perfilLink: NavLink = { href: "/perfil", label: "Meu Perfil", icon: UserCircle };

  const admissaoActive = pathname === "/admissoes" || pathname.startsWith("/admissoes/");
  const avaliacoesActive = pathname.startsWith("/avaliacoes");

  const avaliacoesSub: NavLink[] = [
    { href: "/avaliacoes/banco", label: "Banco de Testes", icon: BookOpen },
  ];

  function itemClass(active: boolean) {
    return cn(
      "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
      active
        ? "bg-wg-green/15 text-wg-green-dark"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    );
  }

  function renderLink(link: NavLink, exact = false) {
    const active = exact
      ? pathname === link.href
      : pathname === link.href || pathname.startsWith(link.href + "/");
    return (
      <Link key={link.href} href={link.href} onClick={onNavClick} className={itemClass(active)}>
        <link.icon className="w-4 h-4" />
        {link.label}
      </Link>
    );
  }

  return (
    <aside className="w-52 border-r border-gray-200 bg-white min-h-[calc(100vh-56px)] p-3 flex-shrink-0">
      <nav className="flex flex-col gap-1">
        {topLinks.map((l) => renderLink(l))}

        {/* Avaliações: item-pai + submenus */}
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
            : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          }
        </Link>
        {avaliacoesActive && (
          <div className="ml-3 flex flex-col gap-1 border-l border-gray-200 pl-2">
            {avaliacoesSub.map((l) => renderLink(l))}
          </div>
        )}

        {/* Admissões: item-pai + submenus (visíveis quando a seção está ativa) */}
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
            : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          }
        </Link>
        {admissaoActive && (
          <div className="ml-3 flex flex-col gap-1 border-l border-gray-200 pl-2">
            {admissaoSub.map((l) => renderLink(l, l.href === "/admissoes"))}
          </div>
        )}

        {adminLinks.map((l) => renderLink(l))}
        {renderLink(perfilLink)}
      </nav>
    </aside>
  );
}
