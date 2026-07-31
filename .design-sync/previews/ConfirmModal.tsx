import { ConfirmModal } from "portal-vagas-wg-ui";

export function Danger() {
  return (
    <ConfirmModal
      isOpen
      variant="danger"
      title="Excluir vaga?"
      message="Esta ação não pode ser desfeita. A vaga e todas as candidaturas associadas serão removidas."
      confirmLabel="Excluir"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  );
}

export function Warning() {
  return (
    <ConfirmModal
      isOpen
      variant="warning"
      title="Encerrar candidaturas?"
      message="Os candidatos não poderão mais se inscrever nesta vaga. Você pode reabri-la depois."
      confirmLabel="Encerrar"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  );
}
