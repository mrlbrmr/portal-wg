import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";
import { KanbanBoard, type KanbanApplication } from "@/components/internal/KanbanBoard";
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
    select: { id: true, title: true, city: true, state: true, applyMode: true },
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
        className="inline-flex items-center gap-1 text-sm text-wg-gray hover:text-wg-green transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar às vagas
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{job.title}</h1>
          <p className="text-sm text-wg-gray mt-1">
            {job.city}/{job.state} · Candidatos por etapa
          </p>
        </div>
        <div className="flex items-center gap-2 bg-wg-card border border-wg-border rounded-xl px-4 py-2.5">
          <Users className="w-4 h-4 text-wg-green" />
          <span className="text-sm text-white font-medium">{cards.length}</span>
          <span className="text-sm text-wg-gray">
            {cards.length === 1 ? "candidatura" : "candidaturas"}
          </span>
        </div>
      </div>

      {job.applyMode !== "NATIVE" && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-400">
          Esta vaga não usa o formulário de inscrição do portal (modo Externo). Novas
          candidaturas não chegam por aqui — altere o &quot;Modo de inscrição&quot; na edição da vaga.
        </div>
      )}

      {cards.length === 0 ? (
        <div className="text-center py-16 text-wg-gray border border-dashed border-wg-border rounded-xl">
          Nenhuma candidatura recebida ainda.
        </div>
      ) : (
        <KanbanBoard applications={cards} canManage={canManage} />
      )}
    </div>
  );
}
