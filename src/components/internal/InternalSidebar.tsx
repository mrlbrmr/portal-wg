"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, Plus, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  role: string;
  onNavClick?: () => void;
}

export default function InternalSidebar({ role, onNavClick }: Props) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/vagas/gerenciar", label: "Vagas", icon: Briefcase },
    ...(role === "ADMIN_RH"
      ? [
          { href: "/vagas/nova", label: "Nova Vaga", icon: Plus },
          { href: "/usuarios", label: "Usuários", icon: Users },
          { href: "/configuracoes", label: "Configurações", icon: Settings },
        ]
      : []),
  ];

  return (
    <aside className="w-52 border-r border-wg-border bg-black min-h-[calc(100vh-56px)] p-3 flex-shrink-0">
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-wg-green/10 text-wg-green"
                  : "text-wg-gray hover:bg-wg-card hover:text-white"
              )}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
