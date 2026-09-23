import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";
import { SETTINGS_SECTIONS, type SettingsItem } from "@/lib/settings/registry";

export const metadata: Metadata = { title: "Configurações — RH" };

function SettingsNavCard({ item }: { item: SettingsItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="group flex h-full items-start gap-3.5 rounded-card border border-wg-border-lighter bg-white p-4 transition-all hover:border-[#C9D9B4] hover:shadow-[0_4px_14px_rgba(26,34,19,.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-wg-sidebar text-wg-green-dark">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-record-title text-wg-ink">{item.title}</span>
        <span className="mt-0.5 block text-meta text-wg-ink-muted">{item.description}</span>
      </span>
      <ChevronRight
        className="mt-2.5 h-4 w-4 shrink-0 text-[#A3AD98] transition-transform group-hover:translate-x-0.5 group-hover:text-wg-green-dark"
        aria-hidden
      />
    </Link>
  );
}

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  return (
    <SettingsPage
      breadcrumb={[]}
      title="Configurações"
      description="Ajuste o portal de carreiras, o recrutamento, a admissão e os cadastros usados no painel."
    >
      <div className="flex flex-col gap-8">
        {SETTINGS_SECTIONS.map((section) => (
          <section key={section.key} aria-labelledby={`cfg-${section.key}`}>
            <div className="mb-3 flex items-center gap-3">
              <h2
                id={`cfg-${section.key}`}
                className="shrink-0 text-label font-semibold uppercase tracking-[0.08em] text-wg-ink-muted"
              >
                {section.label}
              </h2>
              <div className="h-px flex-1 bg-wg-border-lighter" aria-hidden />
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => (
                <li key={item.href}>
                  <SettingsNavCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SettingsPage>
  );
}
