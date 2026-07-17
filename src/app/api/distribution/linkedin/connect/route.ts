import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { isLinkedInConfigured, buildAuthorizationUrl } from "@/lib/distribution/linkedin";

// GET /api/distribution/linkedin/connect — inicia o OAuth do LinkedIn.
// Admin only. Guarda um state anti-CSRF em cookie e redireciona ao LinkedIn.
export async function GET() {
  const session = await auth();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiras.wgbaterias.com.br";

  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.redirect(`${base}/dashboard`);
  }
  if (!isLinkedInConfigured()) {
    return NextResponse.redirect(`${base}/configuracoes/divulgacao?error=nao_configurado`);
  }

  const state = randomUUID();
  const jar = await cookies();
  jar.set("li_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthorizationUrl(state));
}
