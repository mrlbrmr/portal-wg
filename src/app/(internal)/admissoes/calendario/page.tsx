import type { Metadata } from "next";
import { Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  AdmissionCalendar,
  type CalendarAdmission,
} from "@/components/internal/admissao/AdmissionCalendar";

export const metadata: Metadata = { title: "Calendário de Admissões — RH" };

function iso(d: string | null): string | null {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

export default async function AdmissoesCalendarioPage() {
  const supabase = await createClient();
  const { data: admissionsData } = await supabase
    .from("admissions")
    .select("id, fullName, startDate, medicalExamDate, birthDate")
    .is("deletedAt", null)
    .or("startDate.not.is.null,medicalExamDate.not.is.null,birthDate.not.is.null");
  const admissions = (admissionsData ?? []) as Array<{
    id: string;
    fullName: string;
    startDate: string | null;
    medicalExamDate: string | null;
    birthDate: string | null;
  }>;

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
