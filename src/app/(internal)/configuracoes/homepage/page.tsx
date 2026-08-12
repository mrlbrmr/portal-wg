import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CONFIG } from "@/lib/homepage-config";
import HomepageConfigForm from "@/components/internal/HomepageConfigForm";
import { PageHeader } from "@/components/internal/PageHeader";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Configurações da Homepage — RH" };

export default async function HomepageConfigPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const { data: config } = await supabase
    .from("homepage_config")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();

  return (
    <div>
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-1.5 text-sm text-wg-ink-muted hover:text-wg-ink mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Configurações
      </Link>
      <PageHeader
        title="Configurações da Homepage"
        subtitle="Controle o que aparece nos cards de vagas do portal público."
      />
      <HomepageConfigForm initialConfig={config ?? DEFAULT_CONFIG} />
    </div>
  );
}
