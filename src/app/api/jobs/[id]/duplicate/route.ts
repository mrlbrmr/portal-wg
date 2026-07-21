import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateSlug } from "@/lib/utils";
import type { Job } from "@/types/domain";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: originalRaw } = await supabase
    .from("jobs")
    .select(
      "title, department, company, city, state, modality, contractType, description, " +
        "responsibilities, requiredRequirements, desiredRequirements, benefits, " +
        "workSchedule, salaryRange, openings, highlightBenefit, responsible, priority"
    )
    .eq("id", id)
    .maybeSingle();
  // Cliente sem tipos gerados → castamos para os campos selecionados (Job parcial).
  const original = originalRaw as unknown as Job | null;
  if (!original) return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });

  const title = `${original.title} (Cópia)`;
  const baseSlug = generateSlug(title, original.city);
  let slug = baseSlug;
  let counter = 1;
  for (;;) {
    const { data: dup } = await supabase.from("jobs").select("id").eq("slug", slug).maybeSingle();
    if (!dup) break;
    slug = `${baseSlug}-${++counter}`;
  }

  const { data: newJob, error } = await supabase
    .from("jobs")
    .insert({
      ...original,
      title,
      slug,
      status: "DRAFT",
      closingDate: null,
      hiringDeadline: null,
    })
    .select()
    .single();

  if (error || !newJob) {
    return NextResponse.json({ error: "Erro ao duplicar vaga" }, { status: 500 });
  }

  await supabase.from("job_status_history").insert({
    jobId: newJob.id,
    status: "DRAFT",
    changedBy: session.user.name ?? "Admin",
  });

  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");

  return NextResponse.json(newJob, { status: 201 });
}
