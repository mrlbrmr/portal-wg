import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";
import { KanbanBoard, type KanbanApplication } from "@/components/internal/KanbanBoard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Candidatos — RH" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CandidatosPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  const job = await prisma.job.findUnique({
    where: { id },
    select: { id: true, title: true, city: true, state: true },
  });
  if (!job) notFound();

  const applications = await prisma.application.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      resumeName: true,
      stage: true,
      createdAt: true,
    },
  });

  const cards: KanbanApplication[] = applications.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    email: a.email,
    phone: a.phone,
    resumeName: a.resumeName,
    stage: a.stage,
    createdAt: a.createdAt.toISOString(),
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
        <div className="flex items-center gap-2 bg-white border border-gray-200 shadow-sm rounded-xl px-4 py-2.5">
          <Users className="w-4 h-4 text-wg-green-dark" />
          <span className="text-sm text-gray-900 font-medium">{cards.length}</span>
          <span className="text-sm text-gray-500">
            {cards.length === 1 ? "candidatura" : "candidaturas"}
          </span>
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
        <KanbanBoard applications={cards} canManage={canManage} />
      )}
    </div>
  );
}
