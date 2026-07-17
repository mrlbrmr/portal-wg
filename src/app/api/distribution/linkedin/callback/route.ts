import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import {
  exchangeCodeForToken,
  fetchAdministeredOrganization,
  saveLinkedInConnection,
} from "@/lib/distribution/linkedin";

// GET /api/distribution/linkedin/callback — retorno do OAuth do LinkedIn.
// Valida o state, troca o code por token, descobre a página administrada e
// salva a conexão. Redireciona para Configurações → Divulgação com o resultado.
export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiras.wgbaterias.com.br";
  const settings = `${base}/configuracoes/divulgacao`;

  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.redirect(`${base}/dashboard`);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${settings}?error=${encodeURIComponent(oauthError)}`);
  }

  const jar = await cookies();
  const expectedState = jar.get("li_oauth_state")?.value;
  jar.delete("li_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${settings}?error=state_invalido`);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const org = await fetchAdministeredOrganization(token.access_token);
    if (!org) {
      return NextResponse.redirect(`${settings}?error=sem_pagina_admin`);
    }

    await saveLinkedInConnection({
      accessToken: token.access_token,
      expiresInSec: token.expires_in,
      refreshToken: token.refresh_token ?? null,
      orgUrn: org.urn,
      orgName: org.name,
    });

    return NextResponse.redirect(`${settings}?connected=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha_desconhecida";
    return NextResponse.redirect(`${settings}?error=${encodeURIComponent(msg)}`);
  }
}
