import { permanentRedirect } from "next/navigation";

/**
 * O módulo de Requisição de Vagas saiu de baixo de /vagas para reforçar a separação de
 * domínio: solicitação (pedido de autorização) e vaga (processo seletivo) são coisas
 * diferentes. Esta rota fica como redirecionamento por causa dos links antigos em
 * e-mails já enviados.
 */
export default function SolicitacoesLegacyPage(): never {
  permanentRedirect("/solicitacoes");
}
