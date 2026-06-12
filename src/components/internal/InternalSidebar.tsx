"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  role: string;
}

export default function InternalSidebar({ role }: Props) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, always: true },
    { href: "/vagas/gerenciar", label: "Vagas", icon: Briefcase, always: true },
    { href: "/candidatos", label: "Candidatos", icon: Users, always: true },
    ...(role === "ADMIN_RH"
      ? [{ href: "/vagas/nova", label: "Nova Vaga", icon: Plus, always: false }]
      : []),
  ];

  return (
    <aside className="w-52 border-r border-gray-200 bg-white min-h-[calc(100vh-56px)] p-4 flex-shrink-0">
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-orange-50 text-orange-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
