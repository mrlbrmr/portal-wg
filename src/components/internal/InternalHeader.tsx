"use client";

import { signOut } from "next-auth/react";
import { LogOut, ExternalLink, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Props {
  user: { name?: string | null; email?: string | null; role: string };
  onMenuClick?: () => void;
}

export default function InternalHeader({ user, onMenuClick }: Props) {
  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 md:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-2.5 flex-1">
        {/* Hamburguer — só mobile */}
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

        <Link
          href="/perfil"
          className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
        >
          <span className="text-gray-600 hidden sm:block">{user.name}</span>
          <span className="text-xs bg-wg-green/15 text-wg-green-dark px-2 py-0.5 rounded-full font-medium">
            {user.role === "ADMIN_RH" ? "Admin RH" : "Visualizador"}
          </span>
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block">Sair</span>
        </button>
      </div>
    </header>
  );
}
