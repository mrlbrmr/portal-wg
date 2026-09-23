import { redirect } from "next/navigation";
import { REGISTRIES } from "@/lib/settings/registry";

// Cadastros não tem tela própria: abre direto no primeiro cadastro (Cargos).
export default function CadastrosPage() {
  redirect(REGISTRIES[0].href);
}
