import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth } from "@/lib/auth";
import { loadJobRequestFormConfig } from "@/lib/job-requests/form-config-loader";
import { jobRequestFormConfigSchema } from "@/lib/job-requests/extra-fields";
import { logConfigChange } from "@/lib/settings/audit";

// Formulário de solicitação de vaga: título, texto de apresentação e campos adicionais.

export async function GET() {
  const { title, description, fields } = await loadJobRequestFormConfig();
  return NextResponse.json({ title, description, fields });
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
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const parsed = jobRequestFormConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Configuração inválida." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("job_request_form_config").upsert(
    {
      id: "singleton",
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      fields: parsed.data.fields,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 });
  }

  await logConfigChange(session, "formulario-vaga", "Formulário de solicitação de vaga atualizado");
  revalidatePath("/solicitar-vaga");
  revalidatePath("/configuracoes/formulario-vaga");
  return NextResponse.json({ success: true });
}
