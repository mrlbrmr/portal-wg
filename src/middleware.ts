import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isInternalRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/vagas/gerenciar") ||
    pathname.startsWith("/vagas/nova") ||
    (pathname.startsWith("/vagas/") && pathname.endsWith("/editar")) ||
    (pathname.startsWith("/vagas/") && pathname.endsWith("/candidatos")) ||
    pathname.startsWith("/configuracoes") ||
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/usuarios") ||
    pathname.startsWith("/api/jobs") ||
    pathname.startsWith("/api/homepage-config") ||
    pathname.startsWith("/api/users") ||
    // Mutação/leitura de candidatura individual é interna.
    // Atenção: POST /api/applications (exato) é PÚBLICO — só protegemos subrotas.
    /^\/api\/applications\/.+/.test(pathname);

  if (isInternalRoute && !session) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo|images).*)",
  ],
};
