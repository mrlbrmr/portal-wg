import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CONFIG } from "@/lib/homepage-config";
import { getLastConfigChange } from "@/lib/settings/audit";
import HomepageConfigForm from "@/components/internal/HomepageConfigForm";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";

export const metadata: Metadata = { title: "Exibição das vagas — Configurações — RH" };

export default async function JobCardConfigPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: config }, lastChange] = await Promise.all([
    supabase.from("homepage_config").select("*").eq("id", "singleton").maybeSingle(),
    getLastConfigChange("homepage.cards"),
  ]);

  return (
    <SettingsPage
      breadcrumb={[{ label: "Portal de carreiras" }, { label: "Exibição das vagas" }]}
      title="Exibição das vagas"
      description="Escolha quais informações aparecem nos cards de vaga do portal de carreiras."
      lastChange={lastChange}
    >
      <HomepageConfigForm mode="cards" initialConfig={{ ...DEFAULT_CONFIG, ...(config ?? {}) }} />
    </SettingsPage>
  );
}
