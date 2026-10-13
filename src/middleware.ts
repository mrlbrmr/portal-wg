import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isProtectedRoute, unauthenticatedAction } from "@/lib/route-protection";

// Middleware de sessão do Supabase: refresca a sessão (rotaciona cookies) e
// protege as rotas internas — página sem sessão vai ao /login; API chamada por
// fetch recebe 401 JSON. Lista de rotas e regra em src/lib/route-protection.ts.
export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida o token no servidor de Auth (não confie em getSession no
  // middleware). Também dispara o refresh dos cookies via setAll acima.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  if (isProtectedRoute(pathname, req.method) && !user) {
    // API chamada por fetch recebe 401 JSON — não o redirect, que o fetch seguiria e
    // trataria a página de login (200) como sucesso. Ver src/lib/route-protection.ts.
    if (unauthenticatedAction(pathname, req.headers.get("sec-fetch-mode")) === "unauthorized") {
      return NextResponse.json(
        { error: "Sessão expirada. Entre novamente para continuar." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo|images).*)",
  ],
};
