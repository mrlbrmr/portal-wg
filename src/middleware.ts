import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Rotas internas exigem autenticação
  const isInternalRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/vagas/gerenciar") ||
    pathname.startsWith("/candidatos") ||
    pathname.startsWith("/api/jobs") ||
    pathname.startsWith("/api/applications") ||
    pathname.startsWith("/api/ai-review") ||
    pathname.startsWith("/api/candidates");

  if (isInternalRoute && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Aplicar middleware em todas as rotas exceto assets estáticos
    "/((?!_next/static|_next/image|favicon.ico|logo|images).*)",
  ],
};
