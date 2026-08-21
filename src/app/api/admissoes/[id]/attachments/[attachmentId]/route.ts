import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTACHMENTS_BUCKET } from "@/lib/admissao/storage";

// Download/preview de anexo de admissão — SOMENTE para interno autenticado.
// ?preview=true → retorna { url } como JSON para uso em modal de prévia.
// Sem parâmetro → redireciona (302) para a signed URL (download direto).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const isPreview = _req.nextUrl.searchParams.get("preview") === "true";

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

  // Signed URL de 60s: browser baixa direto do Supabase Storage (sem proxy server-side).
  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(att.blobUrl, 60);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "Falha ao acessar o anexo" }, { status: 502 });
  }

  if (isPreview) {
    return NextResponse.json({ url: signed.signedUrl });
  }
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
