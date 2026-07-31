import { EmptyState } from "portal-vagas-wg-ui";
import { Inbox, SearchX } from "lucide-react";

export function NoData() {
  return (
    <div className="w-96">
      <EmptyState
        icon={Inbox}
        title="Nenhuma vaga cadastrada"
        description="Crie sua primeira vaga para começar a receber candidaturas."
      />
    </div>
  );
}

export function NoResults() {
  return (
    <div className="w-96">
      <EmptyState
        icon={SearchX}
        title="Nenhum resultado encontrado"
        description="Ajuste os filtros ou limpe a busca para ver todas as candidaturas."
        action={
          <button className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900">
            Limpar filtros
          </button>
        }
      />
    </div>
  );
}

export function TextOnly() {
  return (
    <div className="w-96">
      <EmptyState
        title="Sem anexos"
        description="Este candidato ainda não enviou documentos."
      />
    </div>
  );
}
