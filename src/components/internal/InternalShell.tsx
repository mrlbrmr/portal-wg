"use client";

import { useState } from "react";
import InternalHeader from "./InternalHeader";
import InternalSidebar from "./InternalSidebar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { PageTransition } from "./PageTransition";

interface Props {
  user: { name?: string | null; email?: string | null; role: string };
  children: React.ReactNode;
}

export default function InternalShell({ user, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
    <div className="min-h-screen bg-wg-bg">
      <InternalHeader
        user={user}
        onMenuClick={() => setSidebarOpen((o) => !o)}
      />

      <div className="flex min-h-[calc(100vh-56px)]">
        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar: drawer mobile / estático desktop */}
        <div
          className={`
            fixed top-14 left-0 bottom-0 z-40
            md:relative md:top-auto md:bottom-auto md:z-auto
            transition-transform duration-200 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          `}
        >
          <InternalSidebar
            role={user.role}
            name={user.name}
            onNavClick={() => setSidebarOpen(false)}
          />
        </div>

        <main className="flex-1 p-4 md:p-5 min-w-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
