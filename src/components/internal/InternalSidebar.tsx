"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Settings,
  Users,
  Calendar,
  BarChart3,
  History,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  FlaskConical,
  BookOpen,
  Star,
  LogOut,
  User,
  ExternalLink,
  Inbox,
} from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  role: string;
  /** Requisições de vaga aguardando ação do RH — badge no menu. */
  pendingRequests?: number;
  name?: string | null;
  email?: string | null;
  onNavClick?: () => void;
}

interface NavLink {
  href: string;
  label: string;
  icon: ElementType;
  /** Contador exibido à direita do item (ex: requisições pendentes). */
  badge?: number;
  /** Complemento lido por leitores de tela junto do contador. */
  badgeLabel?: string;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function InternalSidebar({ role, name, pendingRequests = 0, onNavClick }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = role === "ADMIN_RH";
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Paths preservados; só os rótulos mudaram. "Banco de talentos" é o cadastro de
  // talentos (/talentos) — candidatos de um processo ficam dentro de cada vaga.
  const topLinks: NavLink[] = [
    { href: "/dashboard",       label: "Visão geral",          icon: LayoutDashboard },
    { href: "/solicitacoes",    label: "Solicitações de vaga", icon: Inbox, badge: pendingRequests, badgeLabel: "aguardando ação" },
    { href: "/vagas",           label: "Vagas",                icon: Briefcase },
    { href: "/talentos",        label: "Banco de talentos",    icon: Star },
  ];

  const admissaoLinks: NavLink[] = [
    { href: "/admissoes",              label: "Admissões",    icon: ClipboardCheck },
    { href: "/admissoes/calendario",   label: "Calendário",   icon: Calendar },
    { href: "/admissoes/relatorios",   label: "Relatórios",   icon: BarChart3 },
    { href: "/admissoes/historico",    label: "Histórico",    icon: History },
  ];

  const systemLinks: NavLink[] = isAdmin
    ? [
        { href: "/usuarios",       label: "Usuários",       icon: Users },
        { href: "/configuracoes",  label: "Configurações",  icon: Settings },
      ]
    : [];

  const avaliacoesActive = pathname.startsWith("/avaliacoes");

  const avaliacoesSub: NavLink[] = [
    { href: "/avaliacoes/banco", label: "Banco de testes", icon: BookOpen },
    { href: "/avaliacoes/resultados", label: "Resultados", icon: BarChart3 },
  ];

  function itemClass(active: boolean, sub = false) {
    return cn(
      "flex items-center gap-2.5 py-2 rounded-control text-sm transition-colors border-l-[3px] focus-visible:outline-wg-green",
      sub ? "px-3 text-[13px]" : "px-3",
      active
        ? "bg-black/25 text-white font-semibold border-wg-green"
        : "text-gray-400 font-medium border-transparent hover:bg-black/20 hover:text-white"
    );
  }

  function isActive(href: string, exact: boolean) {
    // /vagas/gerenciar é a lista de vagas — o item "Vagas" (href /vagas) cobre todo o módulo,
    // exceto /vagas/solicitacoes (atalho legado das solicitações).
    if (href === "/vagas") return pathname.startsWith("/vagas") && !pathname.startsWith("/vagas/solicitacoes");
    // "Admissões" cobre lista, ficha, edição e configurações — menos as irmãs do menu.
    if (href === "/admissoes") {
      const siblings = admissaoLinks.filter((l) => l.href !== "/admissoes").map((l) => l.href);
      return pathname.startsWith("/admissoes") && !siblings.some((s) => pathname.startsWith(s));
    }
    if (href === "/solicitacoes") return pathname.startsWith("/solicitacoes") || pathname.startsWith("/vagas/solicitacoes");
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  }

  function renderLink(link: NavLink, exact = false, sub = false) {
    const active = isActive(link.href, exact);
    // "Vagas" navega para a lista (/vagas/gerenciar); o href curto só serve ao cálculo de ativo.
    const target = link.href === "/vagas" ? "/vagas/gerenciar" : link.href;
    return (
      <Link
        key={link.href}
        href={target}
        onClick={onNavClick}
        aria-current={active ? "page" : undefined}
        className={itemClass(active, sub)}
      >
        <link.icon className="w-4 h-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">{link.label}</span>
        {link.badge ? (
          <span className="shrink-0 rounded-full bg-wg-green px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-[#1A2213]">
            {link.badge > 99 ? "99+" : link.badge}
            {link.badgeLabel && <span className="sr-only"> {link.badgeLabel}</span>}
          </span>
        ) : null}
      </Link>
    );
  }

  const roleLabel = role === "ADMIN_RH" ? "Admin RH" : "Visualizador";

  return (
    <aside className="w-[232px] bg-[#1A1D27] border-r border-slate-800 h-full min-h-screen overflow-y-auto scrollbar-dark px-4 py-5 flex-shrink-0 flex flex-col">
      {/* Logo WG */}
      <div className="mb-5 px-1">
        <Image
          src="/logo-wg.png"
          alt="Grupo WG"
          width={96}
          height={40}
          className="h-7 w-auto invert mix-blend-screen"
        />
        <p className="text-gray-500 text-[11px] mt-1">Painel RH</p>
      </div>

      <nav aria-label="Menu principal" className="flex flex-col gap-0.5 flex-1">
        <p className="text-gray-500 text-[10.5px] tracking-[.08em] uppercase font-semibold px-2.5 pt-1 pb-2">
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
          <FlaskConical className="w-4 h-4 shrink-0" aria-hidden />
          <span className="flex-1">Avaliações</span>
          {avaliacoesActive
            ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
            : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
          }
        </Link>
        {avaliacoesActive && (
          <div className="ml-3 flex flex-col gap-0.5 border-l border-gray-700 pl-2">
            {avaliacoesSub.map((l) => renderLink(l, false, true))}
          </div>
        )}

        {/* ── Admissões ───────────────────────────────── */}
        <p className="text-gray-500 text-[10.5px] tracking-[.08em] uppercase font-semibold px-2.5 pt-4 pb-2">
          Admissões
        </p>

        {admissaoLinks.map((l) => renderLink(l, false))}

        {/* ── Sistema ─────────────────────────────────── */}
        {systemLinks.length > 0 && (
          <>
            <p className="text-gray-500 text-[10.5px] tracking-[.08em] uppercase font-semibold px-2.5 pt-4 pb-2">
              Administração
            </p>
            {systemLinks.map((l) => renderLink(l))}
          </>
        )}
      </nav>

      {/* User info + popover com ações */}
      <div ref={userMenuRef} className="mt-4 pt-4 border-t border-gray-800 relative">
        {/* Popover acima */}
        {userMenuOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-gray-700 bg-gray-800 shadow-lg overflow-hidden py-1 z-50">
            <Link
              href="/perfil"
              onClick={() => { setUserMenuOpen(false); onNavClick?.(); }}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-gray-500" />
              Meu perfil
            </Link>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
              Portal público
            </Link>
            <div className="my-1 border-t border-gray-700" />
            <button
              type="button"
              onClick={() => { setUserMenuOpen(false); void handleSignOut(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setUserMenuOpen((o) => !o)}
          aria-expanded={userMenuOpen}
          aria-haspopup="menu"
          aria-label="Menu do usuário"
          className="w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl hover:bg-black/20 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-wg-green-dark text-white flex items-center justify-center text-[12px] font-bold shrink-0">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-white text-[13px] font-semibold truncate">{name ?? "Usuário"}</div>
            <div className="text-gray-400 text-[11px]">{roleLabel}</div>
          </div>
          <ChevronUp
            className={cn(
              "w-3.5 h-3.5 text-gray-500 transition-transform duration-150 shrink-0",
              userMenuOpen ? "" : "rotate-180"
            )}
          />
        </button>
      </div>
    </aside>
  );
}
