import type { Metadata } from "next";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { loadActivityPage, parseActivityFilters, type ActivityCursor, type ActivityItem } from "@/lib/activity/feed";
import { PageHeader } from "@/components/internal/PageHeader";
import { PageContainer } from "@/components/ui/PageContainer";
import { ActivityFeed } from "@/components/internal/activity/ActivityFeed";

export const metadata: Metadata = { title: "Atividades — RH" };

// Rota mantida como /admissoes/historico (links e menu existentes); a página agora é a
// auditoria "Atividades" do portal inteiro — fontes e tipos em src/lib/activity/.
export default async function AtividadesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, config, supabase] = await Promise.all([searchParams, getAdmissionConfig(), createClient()]);
  const filters = parseActivityFilters(params);

  let items: ActivityItem[] = [];
  let nextCursor: ActivityCursor | null = null;
  let loadError = false;
  try {
    ({ items, nextCursor } = await loadActivityPage(supabase, filters, null));
  } catch (e) {
    console.error("[atividades]", e);
    loadError = true;
  }

  return (
    <PageContainer>
      <PageHeader className="mb-0" icon={History} title="Atividades" subtitle="Histórico de ações realizadas no portal." />
      <ActivityFeed
        initialItems={items}
        initialCursor={nextCursor}
        filters={filters}
        users={config.users}
        companies={config.companies}
        branches={config.branches}
        loadError={loadError}
      />
    </PageContainer>
  );
}
