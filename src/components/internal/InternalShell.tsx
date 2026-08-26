"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import InternalSidebar from "./InternalSidebar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { PageTransition } from "./PageTransition";

const STORAGE_KEY = "sidebar-collapsed";

interface Props {
  user: { name?: string | null; email?: string | null; role: string };
  children: React.ReactNode;
}

export default function InternalShell({ user, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed,   setCollapsed]   = useState(false);
  const [hydrated,    setHydrated]    = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50">
        {/* Barra mínima apenas no mobile — desktop não tem header */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-11 bg-[#1A1D27] border-b border-gray-800 flex items-center gap-3 px-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-1.5 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Image
            src="/logo-wg.png"
            alt="Grupo WG"
            width={72}
            height={28}
            className="h-5 w-auto"
          />
        </header>

        <div className="flex min-h-screen pt-11 md:pt-0">
          {/* Overlay mobile */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar: drawer mobile / recolhível no desktop */}
          <div
            className={[
              "fixed top-11 left-0 bottom-0 z-40",
              "md:sticky md:top-0 md:h-screen md:z-auto",
              "overflow-hidden",
              sidebarOpen ? "flex flex-col" : "hidden md:flex md:flex-col",
              hydrated && collapsed ? "md:w-0" : "md:w-[232px]",
            ].join(" ")}
          >
            <InternalSidebar
              role={user.role}
              name={user.name}
              email={user.email}
              onNavClick={() => setSidebarOpen(false)}
            />
          </div>

          {/* Conteúdo principal + botão toggle (desktop) */}
          <main className="flex-1 p-4 md:p-8 min-w-0 relative">
            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
              className="hidden md:flex items-center justify-center absolute left-0 top-5 z-10 w-5 h-8 rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              {collapsed
                ? <PanelLeftOpen  className="w-3 h-3" />
                : <PanelLeftClose className="w-3 h-3" />
              }
            </button>
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
