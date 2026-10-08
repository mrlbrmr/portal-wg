import { redirect } from "next/navigation";

// O Kanban de admissões foi retirado (Kanban só existe no pipeline de candidatos da vaga).
// A rota fica para links salvos não quebrarem.
export default function AdmissoesKanbanPage() {
  redirect("/admissoes");
}
