// POST público do formulário de Solicitação de Vaga (/solicitar-vaga).
//
// A solicitação NÃO cria vaga. Ela entra na fila em `job_requests` com status PENDING_HR
// (aguardando validação do RH) e só vira processo seletivo depois de validada, aprovada e
// de uma ação explícita do RH — ver src/lib/job-requests/service.ts.
//
// Os campos principais são estruturados (schema.ts). O formulário configurável
// (job_request_form_config) continua existindo, mas agora só para perguntas
// COMPLEMENTARES, que vão para `extra_data`.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail, rhInboxEmail, sendEmail } from "@/lib/email";
import { jobRequestReceivedEmail } from "@/lib/email-templates";
import { createJobRequest } from "@/lib/job-requests/service";
import { jobRequestPayloadSchema } from "@/lib/job-requests/schema";
import {
  CONTRACT_TYPE_LABELS,
  JOB_REQUEST_REASON_LABELS,
  MODALITY_LABELS,
} from "@/lib/job-requests/constants";
import type { FormConfig } from "@/types/form-config";

async function loadExtraFields(): Promise<FormConfig["fields"]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("job_request_form_config")
    .select("fields")
    .eq("id", "singleton")
    .maybeSingle();
  return Array.isArray(data?.fields) ? data.fields : DEFAULT_FORM_CONFIG.fields;
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = jobRequestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }
  const payload = parsed.data;

  // Perguntas complementares obrigatórias ainda valem.
  const extraFields = await loadExtraFields();
  const extraErrors: Record<string, string> = {};
  for (const field of extraFields) {
    const val = (payload.extraData[field.key] ?? "").trim();
    if (field.required && !val) extraErrors[field.key] = `${field.label} é obrigatório`;
  }
  if (Object.keys(extraErrors).length > 0) {
    return NextResponse.json({ fieldErrors: extraErrors }, { status: 422 });
  }

  // Gestor logado vira o solicitante de verdade (requested_by_user_id). Sem sessão o
  // pedido segue anônimo — os gestores da WG não têm login hoje.
  const session = await auth();

  const result = await createJobRequest({
    payload,
    requestedByUserId: session?.user.id ?? null,
    actorName: payload.requesterName,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Notifica o RH (não bloqueia a resposta ao gestor se o e-mail falhar).
  const rhEmail = rhInboxEmail();
  if (rhEmail) {
    const rows: Array<[string, string]> = [
      ["Gestor requisitante", payload.requesterName],
      ["Área / Departamento", payload.department],
      ["Empresa / Unidade", payload.location],
      ["Quantidade de vagas", String(payload.openings)],
      ["Motivo da abertura", JOB_REQUEST_REASON_LABELS[payload.reasonType]],
      ...(payload.replacedEmployee
        ? ([["Colaborador substituído", payload.replacedEmployee]] as Array<[string, string]>)
        : []),
      ["Tipo de contratação", CONTRACT_TYPE_LABELS[payload.contractType]],
      ["Modalidade", MODALITY_LABELS[payload.modality]],
      ...(payload.workSchedule
        ? ([["Horário / Jornada", payload.workSchedule]] as Array<[string, string]>)
        : []),
      ["Data desejada para admissão", payload.desiredStartDate],
      ["Justificativa", payload.justification],
      ...extraFields
        .filter((f) => (payload.extraData[f.key] ?? "").trim())
        .map((f) => [f.label, payload.extraData[f.key]] as [string, string]),
    ];

    const { subject, html } = jobRequestReceivedEmail({
      requesterName: payload.requesterName,
      jobTitle: payload.title,
      requestCode: result.data.code,
      requestId: result.data.id,
      rows,
    });
    sendEmail({
      to: rhEmail,
      subject,
      html,
      ...(isValidEmail(payload.requesterEmail) ? { replyTo: payload.requesterEmail } : {}),
    }).catch((err) => console.error("[email] nova solicitação:", err));
  }

  return NextResponse.json(
    { success: true, requestId: result.data.id, requestCode: result.data.code },
    { status: 201 }
  );
}
