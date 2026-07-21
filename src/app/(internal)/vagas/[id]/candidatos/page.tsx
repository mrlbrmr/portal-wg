import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";
import { KanbanBoard, type KanbanApplication } from "@/components/internal/KanbanBoard";
import { AddCandidateModal } from "@/components/internal/AddCandidateModal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Candidatos — RH" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CandidatosPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, city, state")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const [{ data: applications }, { data: stagesData }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, fullName, email, phone, resumeName, stageId, source, createdAt")
      .eq("jobId", id)
      .order("createdAt", { ascending: false }),
    supabase
      .from("application_stages")
      .select("id, name, color")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
  ]);

  const stages = (stagesData ?? []) as Array<{ id: string; name: string; color: string }>;
  const appList = (applications ?? []) as Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string;
    resumeName: string | null;
    stageId: string;
    source: string;
    createdAt: string;
  }>;

  // Contagem de avaliações por candidato (para o resumo no card).
  const assessmentCount = new Map<string, number>();
  if (appList.length > 0) {
    const { data: assessments } = await supabase
      .from("application_assessments")
      .select("applicationId")
      .in("applicationId", appList.map((a) => a.id));
    for (const r of (assessments ?? []) as Array<{ applicationId: string }>) {
      assessmentCount.set(r.applicationId, (assessmentCount.get(r.applicationId) ?? 0) + 1);
    }
  }

  const cards: KanbanApplication[] = appList.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    email: a.email,
    phone: a.phone,
    resumeName: a.resumeName,
    stageId: a.stageId,
    source: a.source,
    assessmentCount: assessmentCount.get(a.id) ?? 0,
    createdAt: new Date(a.createdAt).toISOString(),
  }));

  const canManage = session?.user.role === "ADMIN_RH";

  return (
    <div>
      <Link
        href="/vagas/gerenciar"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-wg-green-dark transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar às vagas
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {job.city}/{job.state} · Candidatos por etapa
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 shadow-sm rounded-xl px-4 py-2.5">
            <Users className="w-4 h-4 text-wg-green-dark" />
            <span className="text-sm text-gray-900 font-medium">{cards.length}</span>
            <span className="text-sm text-gray-500">
              {cards.length === 1 ? "candidatura" : "candidaturas"}
            </span>
          </div>
          {canManage && <AddCandidateModal jobId={job.id} />}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300">
          <EmptyState
            icon={Users}
            title="Nenhuma candidatura recebida ainda"
            description="Quando alguém se inscrever por esta vaga no portal, a candidatura aparece aqui no Kanban por etapa."
          />
        </div>
      ) : (
        <KanbanBoard key={cards.length} applications={cards} stages={stages} canManage={canManage} />
      )}
    </div>
  );
}
