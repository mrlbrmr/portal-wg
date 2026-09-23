import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReadTalentos } from "@/lib/talentos/permissions";
import { loadTalentProfile } from "@/lib/talentos/profile";
import { listTags } from "@/lib/talentos/service";
import { TalentProfileView } from "@/components/internal/talentos/TalentProfileView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("talentos").select("nomeCompleto").eq("id", id).maybeSingle();
  return { title: `${data?.nomeCompleto ?? "Talento"} — Banco de Talentos — RH` };
}

/**
 * Perfil completo do talento — análise aprofundada. Mesmo conteúdo do drawer da lista
 * (TalentWorkspace), em página inteira.
 */
export default async function TalentoPerfilPage({ params }: Props) {
  const session = await auth();
  if (!session || !canReadTalentos(session.user.role)) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();
  const [profile, tags] = await Promise.all([loadTalentProfile(supabase, id), listTags(supabase)]);
  if (!profile) notFound();

  // LGPD: registro de acesso ao perfil completo (só admin lê). Não conta como atividade.
  after(async () => {
    const { error } = await createAdminClient().from("talento_audit_log").insert({
      talentoId: id,
      userId: session.user.id,
      acao: "ACESSOU_PERFIL",
      entidade: "talentos",
      entidadeId: id,
      descricao: `Perfil visualizado por ${session.user.name ?? session.user.email ?? "usuário"}`,
    });
    if (error) console.warn("[talentos] log de acesso", error.message);
  });

  return (
    <TalentProfileView
      initial={{ profile, currentUserId: session.user.id, canManage: session.user.role === "ADMIN_RH" }}
      tags={tags}
    />
  );
}
