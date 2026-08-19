import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTACHMENTS_BUCKET } from "@/lib/admissao/storage";

// Download de anexo de admissão — SOMENTE para interno autenticado (leitura).
// O arquivo fica em Blob privado; entregue server-side, sem expor a URL bruta.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;

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

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
