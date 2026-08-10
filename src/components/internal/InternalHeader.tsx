"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, ExternalLink, Menu, User, Settings, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Props {
  user: { name?: string | null; email?: string | null; role: string };
  onMenuClick?: () => void;
}

export default function InternalHeader({ user, onMenuClick }: Props) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAdmin = user.role === "ADMIN_RH";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
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

  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 md:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-2.5 flex-1">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 text-gray-500 hover:text-gray-900 transition-colors mr-1"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="overflow-hidden">
          <Image
            src="/logo-wg.png"
            alt="Grupo WG"
            width={80}
            height={40}
            className="h-6 w-auto"
          />
        </div>
        <span className="text-gray-300 text-xs mx-1">|</span>
        <span className="text-gray-500 text-xs">Painel RH</span>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-wg-green-dark flex items-center gap-1 transition-colors"
        >
          <span className="hidden sm:block">Portal público</span>
          <ExternalLink className="w-3 h-3" />
        </Link>

        {/* Dropdown de perfil + configurações */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <span className="text-gray-600 hidden sm:block">{user.name}</span>
            <span className="text-xs bg-wg-green/15 text-wg-green-dark px-2 py-0.5 rounded-full font-medium">
              {isAdmin ? "Admin RH" : "Visualizador"}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-gray-200 bg-white shadow-lg z-50 overflow-hidden py-1">
              <Link
                href="/perfil"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-gray-400" />
                Meu Perfil
              </Link>
              {isAdmin && (
                <Link
                  href="/configuracoes"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-gray-400" />
                  Configurações
                </Link>
              )}
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={() => { setDropdownOpen(false); void handleSignOut(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
