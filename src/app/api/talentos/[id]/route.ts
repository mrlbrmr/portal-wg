import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoRead, requireTalentoWrite } from "@/lib/talentos/permissions";
import { loadTalentProfile } from "@/lib/talentos/profile";
import { findDuplicate, logTalentEvents } from "@/lib/talentos/service";

interface Params { params: Promise<{ id: string }> }

// GET — perfil do talento para o drawer (consulta rápida). Abrir o perfil NÃO conta como
// atividade do talento.
export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireTalentoRead();
  if (!access.ok) return NextResponse.json({ error: "Não autorizado" }, { status: access.status });

  const { id } = await params;
  const supabase = await createClient();
  const profile = await loadTalentProfile(supabase, id);
  if (!profile) return NextResponse.json({ error: "Talento não encontrado." }, { status: 404 });

  return NextResponse.json({ profile, currentUserId: access.userId, canManage: access.role === "ADMIN_RH" });
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? v : null));

const updateSchema = z
  .object({
    nomeCompleto: z.string().trim().min(3, "Informe o nome completo.").max(120).optional(),
    email: z.string().trim().email("E-mail inválido.").max(150).optional(),
    telefone: text(30),
    cidade: text(80),
    estado: text(2),
    cargoDesejado: text(120),
    areaInteresse: text(80),
    pretensaoSalarial: z.number().min(0).max(1_000_000).nullable().optional(),
    linkedinUrl: text(300),
    resumoProfissional: text(4000),
  })
  .strict();

const FIELD_LABELS: Record<string, string> = {
  nomeCompleto: "nome",
  email: "e-mail",
  telefone: "telefone",
  cidade: "cidade",
  estado: "estado",
  cargoDesejado: "cargo de interesse",
  areaInteresse: "área",
  pretensaoSalarial: "pretensão salarial",
  linkedinUrl: "LinkedIn",
  resumoProfissional: "resumo profissional",
};

// PATCH — edição dos dados do perfil (ADMIN_RH). Status, tags e favoritos têm ações próprias.
export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireTalentoWrite();
  if (!access.ok) return NextResponse.json({ error: "Não autorizado" }, { status: access.status });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("talentos")
    .select("nomeCompleto, email, telefone, cidade, estado, cargoDesejado, areaInteresse, pretensaoSalarial, linkedinUrl, resumoProfissional")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Talento não encontrado." }, { status: 404 });

  const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as Record<string, unknown>;
  if (typeof patch.estado === "string") patch.estado = patch.estado.toUpperCase();
  const changed = Object.keys(patch).filter((k) => String(patch[k] ?? "") !== String((before as Record<string, unknown>)[k] ?? ""));
  if (changed.length === 0) return NextResponse.json({ ok: true });

  if (changed.includes("email") || changed.includes("telefone")) {
    const dup = await findDuplicate(
      supabase,
      {
        email: changed.includes("email") ? (patch.email as string) : null,
        telefone: changed.includes("telefone") ? (patch.telefone as string | null) : null,
      },
      id
    );
    if (dup) {
      return NextResponse.json(
        {
          error: dup.matchedBy === "email" ? "Já existe um talento com este e-mail." : "Já existe um talento com este telefone.",
          duplicate: dup,
        },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from("talentos")
    .update({ ...Object.fromEntries(changed.map((k) => [k, patch[k]])), ultimaAtividadeEm: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Já existe um talento com este e-mail." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível salvar. Tente novamente." }, { status: 500 });
  }

  await logTalentEvents(supabase, { id: access.userId, name: access.session.user.name ?? access.session.user.email ?? "Equipe de RH" }, [
    {
      talentoId: id,
      acao: "DADOS_EDITADOS",
      descricao: `Dados editados: ${changed.map((k) => FIELD_LABELS[k] ?? k).join(", ")}`,
      metadata: { fields: changed },
    },
  ]);

  revalidatePath("/talentos");
  revalidatePath(`/talentos/${id}`);
  return NextResponse.json({ ok: true });
}
