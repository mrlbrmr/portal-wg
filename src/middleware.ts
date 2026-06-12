import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isInternalRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/vagas/gerenciar") ||
    pathname.startsWith("/candidatos") ||
    pathname.startsWith("/api/jobs") ||
    pathname.startsWith("/api/applications") ||
    pathname.startsWith("/api/ai-review") ||
    pathname.startsWith("/api/candidates");

  if (isInternalRoute) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo|images).*)",
  ],
};
