import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { isValidCpf } from "@/lib/cpf";
import { z } from "zod";

// Rota PÚBLICA — permite ao candidato consultar o status de suas candidaturas.
// Requer CPF + e-mail (segundo fator) para evitar enumeração por CPF sozinho.
// LGPD: retorna apenas dados externos (jobTitle, data, externalLabel da etapa).
// Não retorna: notas internas, resumeUrl, addedBy, cpf, email, telefone.

const bodySchema = z.object({
  cpf: z.string().trim(),
  email: z.string().trim().email("E-mail inválido").max(150),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // 5 tentativas por 10 minutos por IP
  const { allowed, retryAfter } = rateLimit(`status:${ip}`, { limit: 5, windowMs: 600_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Dados inválidos." }, { status: 400 });
  }

  const { cpf, email } = parsed.data;

  if (!isValidCpf(cpf)) {
    return NextResponse.json({ found: false });
  }

  const cpfDigits = cpf.replace(/\D/g, "");
  const supabase = createAdminClient();

  // Busca candidaturas pelo CPF + e-mail (segundo fator), trazendo etapa atual.
  const { data: rows } = await supabase
    .from("applications")
    .select(`
      fullName,
      createdAt,
      jobs ( title, city ),
      application_stages ( externalLabel, kind )
    `)
    .eq("cpf_digits", cpfDigits)
    .ilike("email", email)
    .order("createdAt", { ascending: false });

  if (!rows || rows.length === 0) {
    // Resposta genérica — não revela se o CPF existe mas o e-mail não bate.
    return NextResponse.json({ found: false });
  }

  const candidateName = (rows[0] as { fullName: string }).fullName;

  const applications = rows.map((row) => {
    // Supabase infere FK como array no tipo genérico — usamos unknown para cast seguro.
    const r = row as unknown as {
      createdAt: string;
      jobs: { title: string; city: string | null } | null;
      application_stages: { externalLabel: string | null; kind: string } | null;
    };
    const stage = r.application_stages;
    return {
      jobTitle: r.jobs?.title ?? "Vaga não disponível",
      jobCity: r.jobs?.city ?? null,
      appliedAt: r.createdAt,
      stageLabel: stage?.externalLabel ?? "Em andamento",
      stageKind: (stage?.kind ?? "OPEN") as "OPEN" | "WON" | "LOST",
    };
  });

  return NextResponse.json({ found: true, candidateName, applications });
}
