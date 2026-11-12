import { redirect } from "next/navigation";

// O módulo de admissão digital por WhatsApp foi desativado; a rota fica para links antigos.
export default function DigitaisPage(): never {
  redirect("/admissoes");
}
