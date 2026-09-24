import { redirect } from "next/navigation";

// A edição acontece na própria Central da admissão (/admissoes/[id]), seção por seção.
// Esta rota continua existindo para links antigos e favoritos: abre a ficha já em edição.
export default async function EditarAdmissaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admissoes/${id}?aba=contratacao&editar=1`);
}
