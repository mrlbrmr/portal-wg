import type { Metadata } from "next";
import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  AdmissionCalendar,
  type CalendarAdmission,
} from "@/components/internal/admissao/AdmissionCalendar";

export const metadata: Metadata = { title: "Calendário de Admissões — RH" };

function iso(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function AdmissoesCalendarioPage() {
  const admissions = await prisma.admission.findMany({
    where: {
      deletedAt: null,
      OR: [
        { startDate: { not: null } },
        { medicalExamDate: { not: null } },
        { birthDate: { not: null } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      startDate: true,
      medicalExamDate: true,
      birthDate: true,
    },
  });

  const data: CalendarAdmission[] = admissions.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    startDate: iso(a.startDate),
    examDate: iso(a.medicalExamDate),
    birthDate: iso(a.birthDate),
  }));

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5" /> Calendário
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Inícios, exames médicos e aniversários dos colaboradores em admissão.
        </p>
      </div>

      <AdmissionCalendar admissions={data} />
    </div>
  );
}
