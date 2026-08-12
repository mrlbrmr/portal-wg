import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import { generateSlug } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import { Resend } from "resend";
import type { FormConfig } from "@/types/form-config";

async function loadFormConfig(): Promise<FormConfig> {
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

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfter } = rateLimit(ip, { limit: 5, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

  let body: { formData?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const { formData } = body;
  if (!formData || typeof formData !== "object") {
    return NextResponse.json({ error: "Dados do formulário ausentes" }, { status: 400 });
  }

  // Carregar config atual para validar campos obrigatórios
  const config = await loadFormConfig();
  const fieldErrors: Record<string, string> = {};
  for (const field of config.fields) {
    if (field.required) {
      const val = (formData[field.key] ?? "").trim();
      if (!val) {
        fieldErrors[field.key] = `${field.label} é obrigatório`;
      }
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ fieldErrors }, { status: 422 });
  }

  const supabase = createAdminClient();

  // Inserir em job_requests
  const { data: jobRequest, error: reqError } = await supabase
    .from("job_requests")
    .insert({ form_data: formData })
    .select()
    .single();

  if (reqError || !jobRequest) {
    console.error("job_requests insert error:", reqError);
    return NextResponse.json({ error: "Erro ao registrar solicitação" }, { status: 500 });
  }

  // Mapear campos para o modelo de Job
  const gestor: string = formData["gestor"] ?? "";
  const funcao: string = formData["funcao"] ?? "";
  const horario: string = formData["horario"] ?? "";
  const local: string = formData["local"] ?? "";
  const motivo: string = formData["motivo"] ?? "";
  const requisitosObrigatorios: string = formData["requisitosObrigatorios"] ?? "";
  const requisitosDesejaveis: string = formData["requisitosDesejaveis"] ?? "";
  const observacoes: string = formData["observacoes"] ?? "";

  // Gerar slug único
  const baseSlug = generateSlug(funcao || "solicitacao-vaga", null);
  let slug = baseSlug;
  let counter = 1;
  for (;;) {
    const { data: existing } = await supabase.from("jobs").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${++counter}`;
  }

  // Constrói description em Markdown: o JobForm lê este campo diretamente
  // (campos legados responsibilities/requiredRequirements ficam null).
  const descriptionSections: string[] = [];
  if (requisitosObrigatorios) {
    descriptionSections.push(`### Requisitos Obrigatórios\n\n${requisitosObrigatorios}`);
  }
  if (requisitosDesejaveis) {
    descriptionSections.push(`### Requisitos Desejáveis\n\n${requisitosDesejaveis}`);
  }
  if (observacoes) {
    descriptionSections.push(`### Observações\n\n${observacoes}`);
  }
  const metaParts: string[] = [];
  if (gestor) metaParts.push(`Solicitante: **${gestor}**`);
  if (motivo) metaParts.push(`Motivo: **${motivo}**`);
  if (metaParts.length > 0) {
    descriptionSections.push(`---\n\n${metaParts.join(" · ")}`);
  }
  const description =
    descriptionSections.length > 0
      ? descriptionSections.join("\n\n")
      : "Vaga a definir pelo time de Gente & Gestão.";

  // Criar vaga DRAFT
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      title: funcao || "Vaga sem título",
      responsible: gestor || null,
      workSchedule: horario || null,
      company: local || null,
      department: motivo || null,
      description,
      responsibilities: null,
      requiredRequirements: null,
      desiredRequirements: null,
      modality: "PRESENTIAL",
      contractType: "CLT",
      status: "DRAFT",
      isTalentPool: true,
      priority: "MEDIUM",
      slug,
    })
    .select()
    .single();

  if (jobError || !job) {
    console.error("jobs insert error:", jobError);
    return NextResponse.json({ error: "Erro ao criar rascunho da vaga" }, { status: 500 });
  }

  await supabase.from("job_status_history").insert({
    jobId: job.id,
    status: "DRAFT",
    changedBy: gestor || "Portal",
  });

  await supabase.from("job_requests").update({ job_id: job.id }).eq("id", jobRequest.id);

  // Enviar e-mail via Resend
  const rhEmail = process.env.RH_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (rhEmail && fromEmail && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    resend.emails
      .send({
        from: fromEmail,
        to: rhEmail,
        subject: `Nova solicitação de vaga: ${funcao || "sem título"} — ${gestor || "gestor não informado"}`,
        html: buildEmailHtml(config.fields, formData),
      })
      .catch((err) => console.error("resend error:", err));
  }

  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true, jobId: job.id }, { status: 201 });
}

function buildEmailHtml(
  fields: FormConfig["fields"],
  formData: Record<string, string>
): string {
  const rows = fields
    .filter((f) => formData[f.key])
    .map(
      (f) =>
        `<tr>
          <td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;width:200px;vertical-align:top;border-bottom:1px solid #e5e7eb">${f.label}</td>
          <td style="padding:8px 12px;color:#111827;white-space:pre-wrap;border-bottom:1px solid #e5e7eb">${formData[f.key]}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#90CB46;padding:24px 32px">
      <h1 style="margin:0;color:#fff;font-size:20px">Nova Solicitação de Abertura de Vaga</h1>
      <p style="margin:4px 0 0;color:#e8f5d0;font-size:14px">Recebida pelo Portal de Carreiras WG</p>
    </div>
    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        ${rows}
      </table>
      <p style="margin-top:24px;font-size:13px;color:#6b7280">
        Acesse o painel de vagas para revisar e publicar esta solicitação.
      </p>
    </div>
  </div>
</body>
</html>`;
}
