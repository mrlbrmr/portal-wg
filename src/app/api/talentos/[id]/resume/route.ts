import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTalentoRead } from "@/lib/talentos/permissions";
import { RESUMES_BUCKET } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

// Currículo do PERFIL do talento — só para o RH autenticado. Como em
// /api/applications/[id]/resume: o arquivo fica no bucket privado e o navegador recebe
// uma URL assinada de 60s (o caminho permanente nunca é exposto).

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireTalentoRead();
  if (!access.ok) return NextResponse.json({ error: "Não autorizado" }, { status: access.status });

  const { allowed, retryAfter } = rateLimit(`resume:${access.userId}`, { limit: 30, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Aguarde antes de baixar mais currículos." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: talento } = await supabase.from("talentos").select("curriculoUrl, curriculoNome").eq("id", id).maybeSingle();
  if (!talento?.curriculoUrl) return NextResponse.json({ error: "Currículo não encontrado" }, { status: 404 });

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(
      talento.curriculoUrl as string,
      60,
      req.nextUrl.searchParams.get("download") === "1" ? { download: (talento.curriculoNome as string | null) ?? true } : undefined
    );
  if (error || !signed?.signedUrl) return NextResponse.json({ error: "Falha ao acessar o currículo" }, { status: 502 });

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
