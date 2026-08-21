import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTACHMENTS_BUCKET } from "@/lib/admissao/storage";

// Download/preview de anexo de admissão — SOMENTE para interno autenticado.
// ?inline=true → proxy do binário com Content-Disposition: inline (evita X-Frame-Options do Supabase).
// Sem parâmetro → redireciona (302) para a signed URL (download direto).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const isInline = _req.nextUrl.searchParams.get("inline") === "true";

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: att } = await supabase
    .from("admission_attachments")
    .select("blobUrl, fileName")
    .eq("id", attachmentId)
    .eq("admissionId", id)
    .maybeSingle();
  if (!att) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(att.blobUrl, 120);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "Falha ao acessar o anexo" }, { status: 502 });
  }

  // Proxy o binário para pré-visualização inline: evita X-Frame-Options: DENY do Supabase Storage.
  if (isInline) {
    const upstream = await fetch(signed.signedUrl);
    if (!upstream.ok) {
      return NextResponse.json({ error: "Falha ao buscar o arquivo" }, { status: 502 });
    }
    const buffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(att.fileName)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
