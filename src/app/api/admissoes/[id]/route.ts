import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { admissionSchema } from "@/lib/admissao/validation";
import { admissionInputToData } from "@/lib/admissao/data";
import {
  requireAdmissionWrite,
  requireAdmissionSession,
  canDeleteAdmission,
} from "@/lib/admissao/permissions";

// PATCH /api/admissoes/[id] — edita uma admissão. Escrita = ADMIN_RH.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireAdmissionWrite();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Não autenticado" : "Não autorizado" },
      { status: access.status }
    );
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("admissions")
    .select("id")
    .eq("id", id)
    .is("deletedAt", null)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Admissão não encontrada" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = admissionSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Dados inválidos" }, { status: 400 });
  }

  await supabase
    .from("admissions")
    .update({ ...admissionInputToData(parsed.data), updatedById: access.userId })
    .eq("id", id);

  revalidatePath("/admissoes");
  revalidatePath(`/admissoes/${id}/editar`);
  return NextResponse.json({ id }, { status: 200 });
}

// DELETE /api/admissoes/[id] — soft-delete. Exclusão = ADMIN_RH.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireAdmissionSession();
  if (!access.ok) {
    return NextResponse.json({ error: "Não autenticado" }, { status: access.status });
  }
  if (!canDeleteAdmission(access.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("admissions")
    .select("id")
    .eq("id", id)
    .is("deletedAt", null)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Admissão não encontrada" }, { status: 404 });
  }

  await supabase
    .from("admissions")
    .update({ deletedAt: new Date().toISOString(), updatedById: access.userId })
    .eq("id", id);

  revalidatePath("/admissoes");
  return NextResponse.json({ ok: true }, { status: 200 });
}
