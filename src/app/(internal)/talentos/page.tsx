import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canReadTalentos } from "@/lib/talentos/permissions";
import { parseSort, parseTalentFilters } from "@/lib/talentos/crm";
import { TALENT_PAGE_SIZE, loadTalentFacets, loadTalentPage } from "@/lib/talentos/list";
import { listTags } from "@/lib/talentos/service";
import type { SegmentDto } from "@/lib/talentos/actions";
import { TalentBank } from "@/components/internal/talentos/TalentBank";

export const metadata: Metadata = { title: "Banco de Talentos — RH" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Banco de Talentos (CRM): busca, filtros, ordenação e paginação acontecem no servidor,
 * sobre a view talentos_crm. O estado vive na URL (compartilhável, sobrevive ao F5).
 */
export default async function TalentosPage({ searchParams }: Props) {
  const session = await auth();
  if (!canReadTalentos(session?.user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const filters = parseTalentFilters(sp);
  const { sort, asc } = parseSort(sp);
  const requestedPage = Math.max(1, parseInt(String(sp.page ?? "1"), 10) || 1);
  const seg = typeof sp.seg === "string" ? sp.seg : null;
  const talento = typeof sp.talento === "string" ? sp.talento : null;

  const supabase = await createClient();
  const [firstPage, facets, tags, jobsRes, stagesRes, segmentsRes] = await Promise.all([
    loadTalentPage(supabase, { filters, sort, asc, page: requestedPage }),
    loadTalentFacets(supabase),
    listTags(supabase),
    supabase.from("jobs").select("id, title, code").order("createdAt", { ascending: false }),
    supabase.from("application_stages").select("id, name").order("sortOrder", { ascending: true }),
    supabase.from("talento_segments").select("id, nome, filtros, criadoPorNome, updatedAt").order("nome"),
  ]);

  // Página além do fim (o filtro reduziu o total): mostra a última página existente.
  const lastPage = Math.max(1, Math.ceil(firstPage.total / TALENT_PAGE_SIZE));
  const page =
    requestedPage > lastPage && firstPage.total > 0
      ? await loadTalentPage(supabase, { filters, sort, asc, page: lastPage })
      : firstPage;

  const segments = (segmentsRes.data ?? []) as SegmentDto[];

  return (
    <TalentBank
      page={page}
      filters={filters}
      sort={sort}
      asc={asc}
      facets={facets}
      tags={tags}
      jobs={(jobsRes.data ?? []) as Array<{ id: string; title: string; code: string | null }>}
      stages={(stagesRes.data ?? []) as Array<{ id: string; name: string }>}
      segments={segments}
      activeSegmentId={seg && segments.some((s) => s.id === seg) ? seg : null}
      canManage={session?.user.role === "ADMIN_RH"}
      initialTalentId={talento}
    />
  );
}
