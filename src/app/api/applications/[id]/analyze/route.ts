import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESUMES_BUCKET } from "@/lib/storage";
import { analyzeCv } from "@/lib/ai/cv-analyzer";

// Remove HTML tags, collapse whitespace — para enviar texto limpo ao Claude.
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();

  // Candidatura + campos necessários para análise
  const { data: application } = await supabase
    .from("applications")
    .select("id, resumeUrl, resumeName, jobId")
    .eq("id", id)
    .maybeSingle();
  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }
  if (!application.resumeUrl) {
    return NextResponse.json(
      { error: "Esta candidatura não tem currículo anexado." },
      { status: 400 }
    );
  }

  // Valida que o currículo é PDF antes de fazer o download
  const resumeName = (application.resumeName ?? "").toLowerCase();
  if (!resumeName.endsWith(".pdf")) {
    return NextResponse.json(
      {
        error:
          "A análise por IA suporta apenas currículos em PDF. Converta o arquivo e reenvie o currículo antes de analisar.",
      },
      { status: 400 }
    );
  }

  // Descrição da vaga para contextualizar a análise
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, description, responsibilities, requiredRequirements")
    .eq("id", application.jobId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  }

  // Cria signed URL temporária (120 s) para buscar o PDF via fetch nativo.
  // fetch().arrayBuffer() é mais confiável que Blob.arrayBuffer() para binários
  // em algumas versões do Node.js (evita re-encoding via UTF-16 BOM).
  const supabaseAdmin = createAdminClient();
  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(application.resumeUrl, 120);

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: "Currículo indisponível no storage. Tente novamente." },
      { status: 502 }
    );
  }

  let pdfBuffer: Buffer;
  try {
    const fileRes = await fetch(signedData.signedUrl);
    if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
    pdfBuffer = Buffer.from(await fileRes.arrayBuffer());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Falha ao baixar currículo: ${msg}` },
      { status: 502 }
    );
  }

  // Texto consolidado da vaga (HTML → texto limpo)
  const jobDescription = [
    stripHtml(job.description),
    stripHtml(job.responsibilities),
    stripHtml(job.requiredRequirements),
  ]
    .filter(Boolean)
    .join("\n\n");

  // Executa análise via Claude Haiku
  let result;
  try {
    result = await analyzeCv(pdfBuffer, job.title, jobDescription);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[analyze] IA error:", msg);
    return NextResponse.json({ error: `Falha na análise de IA: ${msg}` }, { status: 502 });
  }

  // Determina parecer baseado no score
  const outcome =
    result.fitScore >= 70 ? "RECOMMEND" : result.fitScore >= 50 ? "PENDING" : "REJECT";

  // Formata resumo legível (aproveitando o campo summary existente)
  const profileLines = [
    result.profile.lastPosition ? `Último cargo: ${result.profile.lastPosition}` : null,
    result.profile.experienceYears !== null
      ? `Experiência: ${result.profile.experienceYears} ano(s)`
      : null,
    result.profile.education ? `Formação: ${result.profile.education}` : null,
    result.profile.skills.length > 0
      ? `Habilidades: ${result.profile.skills.join(", ")}`
      : null,
  ].filter(Boolean);

  const summaryParts = [
    result.fitReason,
    profileLines.length > 0 ? `\n${profileLines.join(" · ")}` : null,
    result.strengths.length > 0
      ? `\nPontos fortes:\n${result.strengths.map((s) => `• ${s}`).join("\n")}`
      : null,
    result.gaps.length > 0
      ? `\nLacunas:\n${result.gaps.map((g) => `• ${g}`).join("\n")}`
      : null,
  ].filter(Boolean);

  const summary = summaryParts.join("\n");

  // Remove análise anterior de IA (mantém lista limpa)
  await supabase
    .from("application_assessments")
    .delete()
    .eq("applicationId", id)
    .eq("kind", "AI_FIT")
    .eq("source", "AI");

  // Grava resultado
  const { error: insertError } = await supabase.from("application_assessments").insert({
    applicationId: id,
    kind: "AI_FIT",
    source: "AI",
    title: `Análise de Currículo — ${job.title}`,
    score: result.fitScore,
    outcome,
    summary,
    evaluator: "IA · Gemini",
    occurredAt: new Date().toISOString(),
  });
  if (insertError) {
    console.error("[analyze] insert error:", insertError);
    return NextResponse.json({ error: "Erro ao salvar análise." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, score: result.fitScore, outcome });
}
