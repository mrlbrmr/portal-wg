import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getRegistry } from "@/lib/settings/registry";
import { getLastConfigChange } from "@/lib/settings/audit";
import { loadRegistryItems } from "@/lib/admissao/registry-data";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";
import { CadastrosNav } from "@/components/internal/cadastros/CadastrosNav";
import { AdmissionStagesManager } from "@/components/internal/cadastros/AdmissionStagesManager";

export const metadata: Metadata = { title: "Etapas da admissão — Cadastros — Configurações — RH" };

export default async function EtapasAdmissaoPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const reg = getRegistry("stage");
  const [stages, lastChange] = await Promise.all([loadRegistryItems("stage"), getLastConfigChange(reg.key)]);

  return (
    <SettingsPage
      breadcrumb={[{ label: "Cadastros", href: "/configuracoes/cadastros" }, { label: reg.title }]}
      title="Cadastros"
      description="Listas usadas nas admissões e nos formulários do painel."
      lastChange={lastChange}
      nav={<CadastrosNav />}
    >
      <AdmissionStagesManager stages={stages} />
    </SettingsPage>
  );
}
