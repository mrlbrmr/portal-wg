import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth } from "@/lib/auth";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import type { FormConfig } from "@/types/form-config";

async function getConfig(): Promise<FormConfig> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("job_request_form_config")
    .select("title, description, fields")
    .eq("id", "singleton")
    .maybeSingle();

  if (!data) return DEFAULT_FORM_CONFIG;

  return {
    title: data.title ?? DEFAULT_FORM_CONFIG.title,
    description: data.description ?? DEFAULT_FORM_CONFIG.description,
    fields: Array.isArray(data.fields) ? data.fields : DEFAULT_FORM_CONFIG.fields,
  };
}

export async function GET() {
  const config = await getConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  let body: FormConfig;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  if (!body.title || !Array.isArray(body.fields)) {
    return NextResponse.json({ error: "Config inválida" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("job_request_form_config")
    .upsert(
      {
        id: "singleton",
        title: body.title,
        description: body.description ?? "",
        fields: body.fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
