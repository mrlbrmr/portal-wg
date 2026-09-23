import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { REGISTRIES } from "@/lib/settings/registry";
import { getLastConfigChange } from "@/lib/settings/audit";
import { loadRegistryItems } from "@/lib/admissao/registry-data";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";
import { CadastrosNav } from "@/components/internal/cadastros/CadastrosNav";
import { RegistryTable } from "@/components/internal/cadastros/RegistryTable";
import type { CatEntity } from "@/lib/admissao/registry-usage";

function findRegistry(slug: string) {
  return REGISTRIES.find((r) => r.href.endsWith(`/${slug}`) && r.entity !== "stage");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const reg = findRegistry((await params).slug);
  return { title: `${reg?.title ?? "Cadastros"} — Cadastros — Configurações — RH` };
}

export default async function CadastroPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const reg = findRegistry((await params).slug);
  if (!reg) notFound();
  const entity = reg.entity as Exclude<CatEntity, "stage">;

  const [items, lastChange] = await Promise.all([loadRegistryItems(entity), getLastConfigChange(reg.key)]);

  return (
    <SettingsPage
      breadcrumb={[{ label: "Cadastros", href: "/configuracoes/cadastros" }, { label: reg.title }]}
      title="Cadastros"
      description="Listas usadas nas admissões e nos formulários do painel."
      lastChange={lastChange}
      nav={<CadastrosNav />}
    >
      <RegistryTable entity={entity} items={items} />
    </SettingsPage>
  );
}
