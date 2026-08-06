import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { isValidCpf } from "@/lib/cpf";

// Rota PÚBLICA — pré-preenche o formulário de candidatura com dados do CPF.
// Retorna apenas campos de contato (sem resumeUrl, notas internas ou CPF bruto).
// Rate-limit restrito para evitar enumeração de CPFs.

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const { allowed, retryAfter } = rateLimit(`cpf-lookup:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns instantes." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

  const cpf = req.nextUrl.searchParams.get("cpf") ?? "";
  if (!isValidCpf(cpf)) {
    return NextResponse.json({ exists: false });
  }

  const cpfDigits = cpf.replace(/\D/g, "");
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("applications")
    .select("fullName, email, phone, candidateCity, candidateState, country")
    .eq("cpf_digits", cpfDigits)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    name: data.fullName,
    email: data.email,
    phone: data.phone,
    city: data.candidateCity,
    state: data.candidateState,
    country: data.country,
  });
}
