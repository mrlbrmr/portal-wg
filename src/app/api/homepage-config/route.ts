import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CONFIG } from "@/lib/homepage-config";
import { z } from "zod";

const homepageConfigSchema = z.object({
  showDepartment: z.boolean().optional(),
  showLocation: z.boolean().optional(),
  showModality: z.boolean().optional(),
  showContractType: z.boolean().optional(),
  showCompany: z.boolean().optional(),
  showWorkSchedule: z.boolean().optional(),
  showSalary: z.boolean().optional(),
  showHighlightBenefit: z.boolean().optional(),
  showOpenings: z.boolean().optional(),
  showFilters: z.boolean().optional(),
  showJobCounter: z.boolean().optional(),
  jobsSectionTitle: z.string().min(1).max(100).optional(),
  jobsSectionSubtitle: z.string().max(300).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: config } = await supabase
    .from("homepage_config")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();
  return NextResponse.json(config ?? DEFAULT_CONFIG);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = homepageConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: config, error } = await supabase
    .from("homepage_config")
    .upsert({ id: "singleton", ...parsed.data }, { onConflict: "id" })
    .select()
    .single();

  if (error || !config) {
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 });
  }

  revalidatePath("/");

  return NextResponse.json(config);
}
