import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionWrite } from "@/lib/admissao/permissions";
import { uploadAdmissionAttachment, validateAttachmentFile } from "@/lib/admissao/storage";

// POST /api/admissoes/[id]/attachments — upload de anexo (multipart).
// É uma API route (não server action) porque server actions têm limite de
// ~1 MB de corpo; anexos vão até 10 MB. Mesmo padrão do upload de currículo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireAdmissionWrite();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Não autenticado" : "Não autorizado" },
      { status: access.status }
    );
  }

  const supabase = await createClient();
  const { data: admission } = await supabase
    .from("admissions")
    .select("id")
    .eq("id", id)
    .is("deletedAt", null)
    .maybeSingle();
  if (!admission) {
    return NextResponse.json({ error: "Admissão não encontrada" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 });
  }

  const check = validateAttachmentFile(file);
  if (!check.ok) {
    return NextResponse.json({ error: check.error ?? "Arquivo inválido." }, { status: 400 });
  }

  const documentTypeIdRaw = form.get("documentTypeId");
  const documentTypeId =
    typeof documentTypeIdRaw === "string" && documentTypeIdRaw ? documentTypeIdRaw : null;

  let uploaded;
  try {
    uploaded = await uploadAdmissionAttachment(file, id);
  } catch {
    return NextResponse.json({ error: "Falha no upload do arquivo." }, { status: 502 });
  }

  // sizeBytes é int8/BigInt no banco, mas passamos number: supabase-js serializa
  // o corpo como JSON e JSON.stringify não suporta BigInt.
  await supabase.from("admission_attachments").insert({
    admissionId: id,
    documentTypeId,
    fileName: uploaded.name,
    blobUrl: uploaded.url,
    mimeType: uploaded.mimeType,
    sizeBytes: uploaded.sizeBytes,
    uploadedById: access.userId,
  });

  revalidatePath(`/admissoes/${id}`);
  return NextResponse.json({ ok: true }, { status: 201 });
}
