import { ToastProvider, useToast } from "portal-vagas-wg-ui";
import { useEffect } from "react";

function Emit({ type, message }: { type: "success" | "error" | "info"; message: string }) {
  const { notify } = useToast();
  useEffect(() => {
    notify(type, message);
  }, [notify, type, message]);
  return (
    <div className="flex h-40 w-80 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
      Conteúdo da aplicação
    </div>
  );
}

export function Success() {
  return (
    <ToastProvider>
      <Emit type="success" message="Candidatura enviada com sucesso!" />
    </ToastProvider>
  );
}

export function Error() {
  return (
    <ToastProvider>
      <Emit type="error" message="Não foi possível salvar. Tente novamente." />
    </ToastProvider>
  );
}

export function Info() {
  return (
    <ToastProvider>
      <Emit type="info" message="A vaga foi movida para Rascunho." />
    </ToastProvider>
  );
}
