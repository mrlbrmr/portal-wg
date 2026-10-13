// Mensagem para quando a CHAMADA de uma server action falha (exceção), não o resultado.
//
// Caso mais comum: o sistema foi publicado de novo enquanto a página estava aberta. O
// Next 15 gera IDs de server action novos a cada build, então a página antiga chama uma
// ação que não existe mais ("Server Action … was not found") — sem este tratamento o erro
// sobe para o error boundary ("Ocorreu um erro inesperado") e o RH não sabe o que fazer.

export function isStaleDeploymentError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /server action.*(not found|was not found)|failed to find server action/i.test(msg);
}

export function actionErrorMessage(e: unknown): string {
  if (isStaleDeploymentError(e)) {
    return "O sistema foi atualizado enquanto esta página estava aberta. Recarregue a página (F5) e tente de novo — nada foi salvo.";
  }
  return "Não foi possível falar com o servidor. Verifique a conexão e tente de novo — nada foi salvo.";
}
