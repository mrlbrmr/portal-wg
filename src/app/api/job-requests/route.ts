// POST público do formulário de Requisição de Pessoal (/solicitar-vaga).
//
// A requisição NÃO cria mais uma vaga: ela entra na fila em `job_requests` com
// status SUBMITTED e só vira vaga quando o RH aprova (ver src/lib/job-requests/actions.ts).
// Isso mantém a lista de vagas limpa e dá rastro de quem pediu, quem decidiu e quando.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail, rhInboxEmail, sendEmail } from "@/lib/email";
import { jobRequestReceivedEmail } from "@/lib/email-templates";
import { extractRequestFields } from "@/lib/job-requests/mapping";
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

  // Valida contra a config vigente: obrigatórios preenchidos + e-mail bem formado.
  const config = await loadFormConfig();
  const fieldErrors: Record<string, string> = {};
  for (const field of config.fields) {
    const val = (formData[field.key] ?? "").trim();
    if (field.required && !val) {
      fieldErrors[field.key] = `${field.label} é obrigatório`;
      continue;
    }
    if (field.type === "email" && val && !isValidEmail(val)) {
      fieldErrors[field.key] = "Informe um e-mail válido";
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ fieldErrors }, { status: 422 });
  }

  const core = extractRequestFields(formData);
  const supabase = createAdminClient();

  const { data: jobRequest, error: reqError } = await supabase
    .from("job_requests")
    .insert({
      form_data: formData,
      status: "SUBMITTED",
      title: core.title,
      requester_name: core.requesterName,
      requester_email: core.requesterEmail,
      reason: core.reason,
      location: core.location,
      openings: core.openings,
      desired_start_date: core.desiredStartDate,
    })
    .select("id")
    .single();

  if (reqError || !jobRequest) {
    console.error("job_requests insert error:", reqError);
    return NextResponse.json({ error: "Erro ao registrar solicitação" }, { status: 500 });
  }

  // Notifica o RH (não bloqueia a resposta ao gestor se o e-mail falhar).
  const rhEmail = rhInboxEmail();
  if (rhEmail) {
    const rows = config.fields
      .filter((f) => (formData[f.key] ?? "").trim())
      .map((f) => [f.label, formData[f.key]] as [string, string]);
    const { subject, html } = jobRequestReceivedEmail({
      requesterName: core.requesterName ?? "",
      rows,
    });
    sendEmail({
      to: rhEmail,
      subject,
      html,
      ...(isValidEmail(core.requesterEmail) ? { replyTo: core.requesterEmail } : {}),
    }).catch((err) => console.error("[email] nova requisição:", err));
  }

  revalidatePath("/vagas/solicitacoes");
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true, requestId: jobRequest.id }, { status: 201 });
}
