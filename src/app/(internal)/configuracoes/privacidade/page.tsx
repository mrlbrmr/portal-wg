import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getLastConfigChange } from "@/lib/settings/audit";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";
import { RetentionManager } from "@/components/internal/settings/RetentionManager";
import { getRetentionMonths, listRetentionRows } from "@/lib/privacy/retention-service";

export const metadata: Metadata = { title: "Privacidade e retenção — Configurações — RH" };
export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const months = await getRetentionMonths(supabase);
  const [rows, lastChange] = await Promise.all([
    listRetentionRows(supabase, months),
    getLastConfigChange("privacidade"),
  ]);

  return (
    <SettingsPage
      breadcrumb={[{ label: "Privacidade" }, { label: "Retenção (LGPD)" }]}
      title="Privacidade e retenção (LGPD)"
      description="Cadastros sem atividade além do prazo, sem processo aberto e sem contratação ficam disponíveis para anonimização. Nada é apagado sem a sua confirmação."
      lastChange={lastChange}
    >
      <RetentionManager months={months} rows={rows} />
    </SettingsPage>
  );
}
