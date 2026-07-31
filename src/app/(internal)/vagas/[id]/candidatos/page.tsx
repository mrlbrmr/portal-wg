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
  const supabase = await createClient();

  // auth + job em paralelo (independentes entre si)
  const [session, { data: job }] = await Promise.all([
    auth(),
    supabase.from("jobs").select("id, title, city, state, isTalentPool").eq("id", id).maybeSingle(),
  ]);
  if (!job) notFound();

  // applications (com assessments embutidos) + stages em paralelo
  const [{ data: applications }, { data: stagesData }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, fullName, email, phone, resumeName, stageId, source, createdAt, assessments:application_assessments(id)")
      .eq("jobId", id)
      .order("createdAt", { ascending: false }),
    supabase
      .from("application_stages")
      .select("id, name, color, kind, templateId")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
  ]);

  // Para colunas TEST, busca o nome do template vinculado
  const rawStages = (stagesData ?? []) as Array<{
    id: string; name: string; color: string; kind: string; templateId: string | null;
  }>;
  const testTemplateIds = rawStages
    .filter((s) => s.kind === "TEST" && s.templateId)
    .map((s) => s.templateId as string);

  const templateNames = new Map<string, string>();
  if (testTemplateIds.length > 0) {
    const { data: tmplData } = await supabase
      .from("assessment_templates")
      .select("id, name")
      .in("id", testTemplateIds);
    (tmplData ?? []).forEach((t: { id: string; name: string }) => templateNames.set(t.id, t.name));
  }

  const stages = rawStages.map((s) => ({
    ...s,
    templateName: s.templateId ? (templateNames.get(s.templateId) ?? null) : null,
  }));
  const appList = (applications ?? []) as Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string;
    resumeName: string | null;
    stageId: string;
    source: string;
    createdAt: string;
    assessments: Array<{ id: string }>;
  }>;

  const cards: KanbanApplication[] = appList.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    email: a.email,
    phone: a.phone,
    resumeName: a.resumeName,
    stageId: a.stageId,
    source: a.source,
    assessmentCount: (a.assessments ?? []).length,
    createdAt: new Date(a.createdAt).toISOString(),
  }));

  const canManage = session?.user.role === "ADMIN_RH";

  return (
    <div>
      <Link
        href="/vagas/gerenciar"
        className="inline-flex items-center gap-1 text-[13px] font-medium text-[#55614A] hover:text-[#1A2213] transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar às vagas
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#1A2213] leading-tight">{job.title}</h1>
          <p className="text-[13px] text-[#55614A] mt-1">
            {job.isTalentPool
            ? "Banco de Talentos"
            : job.city
            ? `${job.city}/${job.state}`
            : "Múltiplas cidades"}{" "}
          · Candidatos por etapa
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#EEF4E3] border border-[#DCE8CC] rounded-xl px-4 py-2">
            <Users className="w-4 h-4 text-[#4F6930]" />
            <span className="text-[13.5px] font-bold text-[#1A2213]">{cards.length}</span>
            <span className="text-[13.5px] text-[#55614A]">
              {cards.length === 1 ? "candidatura" : "candidaturas"}
            </span>
          </div>
          {canManage && <AddCandidateModal jobId={job.id} />}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DCE8CC]">
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
