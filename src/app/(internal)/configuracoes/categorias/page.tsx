import { redirect } from "next/navigation";

// "Categorias" virou "Cadastros". Mantém links e favoritos antigos funcionando.
export default function CategoriasPage() {
  redirect("/configuracoes/cadastros");
}
