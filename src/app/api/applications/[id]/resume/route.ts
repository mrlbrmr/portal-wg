import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getResumeBlob, validateResumeFile, uploadResume, deleteResume } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

// Download do currículo — SOMENTE para RH autenticado.
// LGPD: o currículo fica em Blob privado; esta rota o entrega server-side,
// sem nunca expor a URL do blob ao cliente.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { allowed, retryAfter } = rateLimit(`resume:${session.user.id}`, { limit: 30, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Aguarde antes de baixar mais currículos." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("applications")
    .select("resumeUrl, resumeName")
    .eq("id", id)
    .maybeSingle();
  if (!application?.resumeUrl) {
    return NextResponse.json({ error: "Currículo não encontrado" }, { status: 404 });
  }

  let blob: Blob | null;
  try {
    blob = await getResumeBlob(application.resumeUrl);
  } catch {
    return NextResponse.json({ error: "Falha ao acessar o currículo" }, { status: 502 });
  }

  if (!blob) {
    return NextResponse.json({ error: "Currículo indisponível" }, { status: 404 });
  }

  const fileName = (application.resumeName ?? "curriculo").replace(/["\r\n]/g, "");
  const contentType = blob.type || "application/octet-stream";

  return new NextResponse(blob.stream(), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// Substituição de currículo — ADMIN_RH only.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("applications")
    .select("id, jobId, resumeUrl")
    .eq("id", id)
    .maybeSingle();
  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  const validation = validateResumeFile(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let uploaded: { url: string; name: string };
  try {
    uploaded = await uploadResume(file, application.jobId);
  } catch {
    return NextResponse.json({ error: "Falha ao enviar o arquivo" }, { status: 502 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await supabase
    .from("applications")
    .update({ resumeUrl: uploaded.url, resumeName: uploaded.name } as any)
    .eq("id", id);

  if (updateError) {
    await deleteResume(uploaded.url).catch(() => {});
    return NextResponse.json({ error: "Erro ao salvar o currículo" }, { status: 500 });
  }

  if (application.resumeUrl) {
    await deleteResume(application.resumeUrl).catch(() => {});
  }

  revalidatePath(`/vagas/${application.jobId}/candidatos`);
  return NextResponse.json({ ok: true, resumeName: uploaded.name });
}
