"use client";

import { signOut } from "next-auth/react";
import { LogOut, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Props {
  user: { name?: string | null; email?: string | null; role: string };
}

export default function InternalHeader({ user }: Props) {
  return (
    <header className="bg-black border-b border-wg-border h-14 flex items-center px-6 sticky top-0 z-40">
      <div className="flex items-center gap-2.5 flex-1">
        <div className="bg-white rounded-lg overflow-hidden p-1">
          <Image
            src="/logo-wg.png"
            alt="Grupo WG"
            width={80}
            height={40}
            className="h-6 w-auto"
          />
        </div>
        <span className="text-wg-border text-xs mx-1">|</span>
        <span className="text-wg-gray text-xs">Painel RH</span>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-wg-gray hover:text-wg-green flex items-center gap-1 transition-colors"
        >
          Portal público
          <ExternalLink className="w-3 h-3" />
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-wg-gray hidden sm:block">{user.name}</span>
          <span className="text-xs bg-wg-green/10 text-wg-green px-2 py-0.5 rounded-full font-medium">
            {user.role === "ADMIN_RH" ? "Admin RH" : "Visualizador"}
          </span>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 text-sm text-wg-gray hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block">Sair</span>
        </button>
      </div>
    </header>
  );
}
