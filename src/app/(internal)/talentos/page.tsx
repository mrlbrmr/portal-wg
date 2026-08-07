import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { canReadTalentos } from "@/lib/talentos/permissions";
import TalentosList from "@/components/internal/talentos/TalentosList";
import type { TalentoListItem, TalentoTag } from "@/lib/talentos/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Talentos — RH" };

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ page?: string; q?: string; status?: string; estado?: string }>;
}

export default async function TalentosPage({ searchParams }: Props) {
  const session = await auth();
  if (!canReadTalentos(session?.user.role)) redirect("/dashboard");

  const sp      = await searchParams;
  const page    = Math.max(1, parseInt(sp.page ?? "1", 10));
  const q       = sp.q?.trim() ?? "";
  const status  = sp.status ?? "";
  const estado  = sp.estado ?? "";
  const offset  = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let query = supabase
    .from("talentos")
    .select(
      `id, nomeCompleto, email, telefone, cidade, estado,
       cargoDesejado, statusBanco, ultimaAtividadeEm, createdAt,
       assignments:talento_tag_assignments(tag:talento_tags(id, nome, cor))`,
      { count: "exact" },
    );

  if (q)      query = query.or(`nomeCompleto.ilike.%${q}%,email.ilike.%${q}%,cargoDesejado.ilike.%${q}%`);
  if (status) query = query.eq("statusBanco", status);
  if (estado) query = query.eq("estado", estado);

  const { data, count, error } = await query
    .order("ultimaAtividadeEm", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;

  const talentos: TalentoListItem[] = (data ?? []).map((t: Record<string, unknown>) => ({
    id:               t.id as string,
    nomeCompleto:     t.nomeCompleto as string,
    email:            t.email as string,
    telefone:         t.telefone as string | null,
    cidade:           t.cidade as string | null,
    estado:           t.estado as string | null,
    cargoDesejado:    t.cargoDesejado as string | null,
    statusBanco:      t.statusBanco as TalentoListItem["statusBanco"],
    ultimaAtividadeEm: t.ultimaAtividadeEm as string,
    createdAt:        t.createdAt as string,
    tags: ((t.assignments as { tag: TalentoTag | null }[]) ?? []).flatMap((a) =>
      a.tag ? [a.tag] : [],
    ),
  }));

  const { data: allTags } = await supabase
    .from("talento_tags")
    .select("id, nome, cor")
    .order("nome");

  return (
    <TalentosList
      talentos={talentos}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      isAdmin={session?.user.role === "ADMIN_RH"}
      availableTags={(allTags ?? []) as TalentoTag[]}
      initialQ={q}
      initialStatus={status}
      initialEstado={estado}
    />
  );
}
