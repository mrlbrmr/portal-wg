// E-mail FICTÍCIO (email@email.com, editar@gmail.com…) digitado só para passar pelo campo.
// Nunca é gravado: o e-mail do talento é único, então um fictício repetido JUNTA pessoas
// diferentes no mesmo perfil do Banco de Talentos (aconteceu: 12 pessoas em 5 perfis).
// No cadastro manual o RH deixa o e-mail em branco; no portal o candidato informa o real.
// Puro e testado (email-placeholder.test.ts).

const PLACEHOLDER_LOCAL = new Set([
  "email", "e-mail", "editar", "ajustar", "teste", "test", "exemplo", "example",
  "nao", "naotem", "nao-tem", "naopossui", "sem", "sememail", "sem-email", "nenhum", "xxx", "x", "a", "aaa",
]);

const PLACEHOLDER_DOMAINS = new Set([
  "email.com", "editar.com", "ajustar.com", "teste.com", "test.com", "exemplo.com", "example.com",
  "naotem.com", "sememail.com", "xxx.com",
]);

export const PLACEHOLDER_EMAIL_MESSAGE =
  "Este e-mail parece fictício. Informe o e-mail real ou deixe o campo em branco.";

export function isPlaceholderEmail(value: string | null | undefined): boolean {
  const e = (value ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  return PLACEHOLDER_LOCAL.has(local) || PLACEHOLDER_DOMAINS.has(domain);
}
