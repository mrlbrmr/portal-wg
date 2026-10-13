// Regra PURA de proteção de rotas usada pelo middleware (src/middleware.ts).
// Fica fora do middleware para ser testada (route-protection.test.ts).

/**
 * Rotas que exigem sessão. Tudo o que não está aqui é público ou faz a própria
 * checagem (candidatura, admissão/avaliação por token, feeds, intranet, jornada, cron...).
 */
export function isProtectedRoute(pathname: string, method: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/solicitacoes") ||
    pathname.startsWith("/vagas/solicitacoes") ||
    pathname.startsWith("/vagas/gerenciar") ||
    pathname.startsWith("/vagas/nova") ||
    (pathname.startsWith("/vagas/") && pathname.endsWith("/editar")) ||
    (pathname.startsWith("/vagas/") && pathname.endsWith("/candidatos")) ||
    pathname.startsWith("/configuracoes") ||
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/usuarios") ||
    pathname.startsWith("/admissoes") ||
    pathname.startsWith("/api/admissoes") ||
    // GET /api/jobs (lista) é PÚBLICO: o "Carregar mais" do portal usa; sem sessão a rota
    // devolve só colunas públicas de vagas publicadas (onlyPublicVisible). O resto é interno.
    (pathname.startsWith("/api/jobs") && !(pathname === "/api/jobs" && method === "GET")) ||
    pathname.startsWith("/api/homepage-config") ||
    pathname.startsWith("/api/users") ||
    // Mutação/leitura de candidatura individual é interna.
    // Atenção: POST /api/applications (exato) é PÚBLICO — só protegemos subrotas.
    /^\/api\/applications\/.+/.test(pathname)
  );
}

/**
 * O que fazer com uma requisição SEM sessão numa rota protegida.
 *
 * - Página → redireciona ao /login.
 * - API chamada por fetch → 401 JSON. Redirecionar aqui é perigoso: o fetch segue o 307,
 *   recebe a página de login com 200 e o cliente trata como sucesso (ex.: Kanban mostrava
 *   "movido" sem gravar nada com a sessão expirada).
 * - API aberta por link (download do CV, anexo, export) → navegação de documento
 *   (`Sec-Fetch-Mode: navigate`): mantém o /login, que devolve o usuário ao link depois.
 */
export function unauthenticatedAction(
  pathname: string,
  secFetchMode: string | null
): "login" | "unauthorized" {
  const isApi = pathname === "/api" || pathname.startsWith("/api/");
  if (!isApi) return "login";
  return secFetchMode === "navigate" ? "login" : "unauthorized";
}
