// Cabeçalho do formulário de solicitação de vaga (título, apresentação e aviso).
// Compartilhado entre a página pública /solicitar-vaga e o "Visualizar como gestor"
// das Configurações — o preview não pode divergir do que o gestor vê.

export function JobRequestIntro({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">{title}</h1>
      {description && <p className="text-sm text-gray-600 mb-4">{description}</p>}

      <div className="mb-10 rounded-lg border border-wg-green/30 bg-wg-green/5 px-4 py-3">
        <p className="text-sm font-semibold text-wg-green-dark">Isto é uma solicitação, não a vaga.</p>
        <p className="text-xs text-gray-600 mt-0.5">
          Você está registrando uma necessidade de contratação. O RH valida o pedido e encaminha para
          aprovação; o processo seletivo é aberto depois, com a divulgação e as etapas definidas pelo time
          de Gente &amp; Gestão.
        </p>
      </div>
    </>
  );
}
