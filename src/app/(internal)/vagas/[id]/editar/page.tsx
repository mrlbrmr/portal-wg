import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import JobForm from "@/components/internal/JobForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Editar Vaga — RH" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarVagaPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Editar Vaga</h1>
      <div className="bg-wg-card border border-wg-border rounded-xl p-6">
        <JobForm job={job} />
      </div>
    </div>
  );
}
