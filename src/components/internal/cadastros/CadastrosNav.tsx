"use client";

import { SettingsSubnav } from "@/components/internal/settings/SettingsTabs";
import { REGISTRIES } from "@/lib/settings/registry";

/** Navegação interna de Cadastros — uma URL por cadastro. */
export function CadastrosNav() {
  return (
    <SettingsSubnav
      label="Cadastros"
      items={REGISTRIES.map((r) => ({ href: r.href, label: r.title, icon: r.icon }))}
    />
  );
}
