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
import { jobRequestReceivedEmail, jobRequestSubmittedEmail } from "@/lib/email-templates";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { isHoneypotFilled } from "@/lib/job-requests/submission-guard";
import { formatDateBR } from "@/lib/job-requests/mapping";
import { desiredStartDateProblem } from "@/lib/job-requests/dates";
import { createJobRequest } from "@/lib/job-requests/service";
import { jobRequestPayloadSchema } from "@/lib/job-requests/schema";
import { pruneHiddenExtraData, validateExtraData } from "@/lib/job-requests/extra-fields";
import {
  CONTRACT_TYPE_LABELS,
  JOB_REQUEST_REASON_LABELS,
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

  // Campo-isca preenchido = robô. Responde como sucesso (não ensina o robô) e não grava nada.
  if (isHoneypotFilled(body)) {
    console.warn("[job-requests] campo-isca preenchido; ignorado", { ip });
    return NextResponse.json({ success: true, requestId: null, requestCode: null }, { status: 201 });
  }

  // reCAPTCHA v3 consultivo: só barra bot evidente (token válido + score muito baixo).
  const recaptchaToken =
    body && typeof body === "object" ? (body as Record<string, unknown>).recaptchaToken : null;
  const captcha = await verifyRecaptcha(typeof recaptchaToken === "string" ? recaptchaToken : null, {
    expectedAction: "submit_job_request",
    remoteIp: ip !== "unknown" ? ip : undefined,
  });
  if (!captcha.ok) {
    return NextResponse.json(
      { error: "Falha na verificação de segurança. Recarregue a página e tente novamente." },
      { status: 400 }
    );
  }

  const parsed = jobRequestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }
  const payload = parsed.data;

  const dateProblem = desiredStartDateProblem(payload.desiredStartDate);
  if (dateProblem) {
    return NextResponse.json({ fieldErrors: { desiredStartDate: [dateProblem] } }, { status: 422 });
  }

  // Perguntas complementares obrigatórias ainda valem (só as visíveis pelas condições).
  const extraFields = await loadExtraFields();
  const extraErrors = validateExtraData(extraFields, payload.extraData);
  if (Object.keys(extraErrors).length > 0) {
    return NextResponse.json({ fieldErrors: extraErrors }, { status: 422 });
  }
  payload.extraData = pruneHiddenExtraData(extraFields, payload.extraData);

  // Gestor logado vira o solicitante de verdade (requested_by_user_id). Sem sessão o
  // pedido segue anônimo — os gestores da WG não têm login hoje.
  const session = await auth();

  const result = await createJobRequest({
    payload,
    requestedByUserId: session?.user.id ?? null,
    actorName: payload.requesterName,
  });

  if (!result.ok) {
    if (result.field) {
      return NextResponse.json({ fieldErrors: { [result.field]: [result.error] } }, { status: 422 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Notifica o RH (não bloqueia a resposta ao gestor se o e-mail falhar).
  const rhEmail = rhInboxEmail();
  if (rhEmail) {
    const rows: Array<[string, string]> = [
      ["Gestor requisitante", payload.requesterName],
      ["Área", payload.department ?? ""],
      ["Filial", payload.location ?? ""],
      ["Número de posições", String(payload.openings)],
      ["Motivo da abertura", JOB_REQUEST_REASON_LABELS[payload.reasonType]],
      ...(payload.replacedEmployee
        ? ([["Colaborador substituído", payload.replacedEmployee]] as Array<[string, string]>)
        : []),
      ["Tipo de contratação", CONTRACT_TYPE_LABELS[payload.contractType]],
      ...(payload.workSchedule
        ? ([["Horário / Jornada", payload.workSchedule]] as Array<[string, string]>)
        : []),
      ["Data desejada para admissão", formatDateBR(payload.desiredStartDate)],
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

  // Confirmação ao gestor: a tela promete "um e-mail a cada etapa" — este é o primeiro.
  if (isValidEmail(payload.requesterEmail)) {
    const { subject, html } = jobRequestSubmittedEmail({
      requesterName: payload.requesterName,
      jobTitle: payload.title,
      requestCode: result.data.code,
      rows: [
        ["Filial", payload.location ?? ""],
        ["Área", payload.department ?? ""],
        ["Número de posições", String(payload.openings)],
        ["Data desejada para admissão", formatDateBR(payload.desiredStartDate)],
      ],
    });
    sendEmail({ to: payload.requesterEmail, subject, html }).catch((err) =>
      console.error("[email] confirmação ao gestor:", err)
    );
  }

  return NextResponse.json(
    { success: true, requestId: result.data.id, requestCode: result.data.code },
    { status: 201 }
  );
}
