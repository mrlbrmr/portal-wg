import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { isPublicJobStatus } from "@/lib/utils";

const MODALITY_LABELS: Record<string, string> = {
  PRESENTIAL: "Presencial",
  REMOTE: "Remoto",
  HYBRID: "Híbrido",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativa",
  SCREENING: "Triagem",
  INTERVIEW: "Entrevistas",
  ADMISSION: "Admissão",
  PAUSED: "Pausada",
  CLOSED: "Cancelada",
};

const CONTRACT_LABELS: Record<string, string> = {
  CLT: "CLT",
  PJ: "PJ",
  INTERNSHIP: "Estágio",
  APPRENTICE: "Jovem Aprendiz",
  TEMPORARY: "Temporário",
  OTHER: "Outro",
};

function csvEscape(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (rawStatus && Object.values(JobStatus).includes(rawStatus as JobStatus)) {
    where.status = rawStatus;
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      title: true, department: true, company: true, city: true, state: true,
      modality: true, contractType: true, status: true, openings: true,
      responsible: true, createdAt: true, closingDate: true, hiringDeadline: true,
      tallyFormUrl: true, slug: true, id: true,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const header = [
    "Título", "Área", "Empresa/Unidade", "Cidade", "UF", "Modalidade", "Contrato",
    "Status", "Vagas", "Responsável", "Criada em", "Encerra em", "Prazo contratação", "Link público",
  ];

  const rows = jobs.map((j) => [
    j.title,
    j.department ?? "",
    j.company ?? "",
    j.city,
    j.state,
    MODALITY_LABELS[j.modality] ?? j.modality,
    CONTRACT_LABELS[j.contractType] ?? j.contractType,
    STATUS_LABELS[j.status] ?? j.status,
    j.openings ?? "",
    j.responsible ?? "",
    new Date(j.createdAt).toLocaleDateString("pt-BR"),
    j.closingDate ? new Date(j.closingDate).toLocaleDateString("pt-BR") : "",
    j.hiringDeadline ? new Date(j.hiringDeadline).toLocaleDateString("pt-BR") : "",
    isPublicJobStatus(j.status) ? `${appUrl}/vagas/${j.slug ?? j.id}` : "",
  ]);

  const bom = "﻿";
  const csv = bom + [header, ...rows]
    .map((row) => row.map((cell) => csvEscape(cell)).join(";"))
    .join("\r\n");

  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vagas-wg-${date}.csv"`,
    },
  });
}
