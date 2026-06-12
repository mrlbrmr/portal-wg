"use client";

import { signOut } from "next-auth/react";
import { Zap, LogOut, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Props {
  user: { name?: string | null; email?: string | null; role: string };
}

export default function InternalHeader({ user }: Props) {
  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center px-6 sticky top-0 z-40">
      <div className="flex items-center gap-2 flex-1">
        <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-sm">WG Baterias</span>
        <span className="text-gray-300 text-xs mx-2">|</span>
        <span className="text-gray-500 text-xs">Painel RH</span>
      </div>

      <div className="flex items-center gap-4">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-orange-500 flex items-center gap-1 transition-colors"
        >
          Portal público
          <ExternalLink className="w-3 h-3" />
        </a>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 hidden sm:block">{user.name}</span>
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            {user.role === "ADMIN_RH" ? "Admin RH" : "Visualizador"}
          </span>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block">Sair</span>
        </button>
      </div>
    </header>
  );
}
