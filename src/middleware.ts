import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware de sessão do Supabase: refresca a sessão (rotaciona cookies) e
// protege as rotas internas — quem não está autenticado é mandado ao /login.
// Mesma lista de rotas internas do NextAuth anterior.
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

  const isInternalRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/vagas/gerenciar") ||
    pathname.startsWith("/vagas/nova") ||
    (pathname.startsWith("/vagas/") && pathname.endsWith("/editar")) ||
    (pathname.startsWith("/vagas/") && pathname.endsWith("/candidatos")) ||
    pathname.startsWith("/configuracoes") ||
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/usuarios") ||
    pathname.startsWith("/admissoes") ||
    pathname.startsWith("/api/admissoes") ||
    pathname.startsWith("/api/jobs") ||
    pathname.startsWith("/api/homepage-config") ||
    pathname.startsWith("/api/users") ||
    // Mutação/leitura de candidatura individual é interna.
    // Atenção: POST /api/applications (exato) é PÚBLICO — só protegemos subrotas.
    /^\/api\/applications\/.+/.test(pathname);

  if (isInternalRoute && !user) {
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
