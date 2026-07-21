import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getResumeBlob } from "@/lib/storage";

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
