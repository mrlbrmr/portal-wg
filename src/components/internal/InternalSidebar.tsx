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
  FlaskConical,
  BookOpen,
  Star,
  LogOut,
  User,
  ExternalLink,
} from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  role: string;
  name?: string | null;
  email?: string | null;
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

  const topLinks: NavLink[] = [
    { href: "/dashboard",      label: "Dashboard", icon: LayoutDashboard },
    { href: "/vagas/gerenciar", label: "Vagas",     icon: Briefcase },
    { href: "/talentos",       label: "Talentos",  icon: Star },
  ];

  const admissaoLinks: NavLink[] = [
    { href: "/admissoes",              label: "Dashboard",    icon: LayoutDashboard },
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
    { href: "/avaliacoes/banco", label: "Banco de Testes", icon: BookOpen },
    { href: "/avaliacoes/resultados", label: "Resultados", icon: BarChart3 },
  ];

  function itemClass(active: boolean, sub = false) {
    return cn(
      "flex items-center gap-2.5 py-2.5 rounded-[10px] text-sm transition-colors",
      sub ? "px-3 text-[13px]" : "px-3",
      active
        ? "bg-black/20 text-white font-bold border-l-[3px] border-wg-green"
        : "text-gray-400 font-medium hover:bg-black/20 hover:text-white"
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
    <aside className="w-[232px] bg-[#1A1D27] border-r border-gray-800 h-full min-h-screen overflow-y-auto px-4 py-5 flex-shrink-0 flex flex-col">
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

      <nav className="flex flex-col gap-0.5 flex-1">
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
          <FlaskConical className="w-4 h-4 shrink-0" />
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

        {admissaoLinks.map((l) => renderLink(l, l.href === "/admissoes"))}

        {/* ── Sistema ─────────────────────────────────── */}
        {systemLinks.length > 0 && (
          <>
            <p className="text-gray-500 text-[10.5px] tracking-[.08em] uppercase font-semibold px-2.5 pt-4 pb-2">
              Sistema
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
              Meu Perfil
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
