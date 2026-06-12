import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de Privacidade",
  description: "Como o Grupo WG trata os dados pessoais dos candidatos em conformidade com a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Aviso de Privacidade</h1>
      <p className="text-sm text-gray-500 mb-8">Última atualização: Junho de 2026</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-sm leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Quem somos</h2>
          <p>
            O <strong>Grupo WG / WG Baterias</strong> (doravante "WG" ou "nós") é o
            controlador dos dados pessoais coletados por meio deste Portal de Carreiras.
            Estamos comprometidos com a proteção da privacidade dos candidatos e com o
            cumprimento da Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Dados que coletamos</h2>
          <p>Coletamos apenas os dados mínimos necessários ao processo seletivo:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Nome completo</li>
            <li>E-mail</li>
            <li>Telefone / WhatsApp</li>
            <li>Cidade e UF de residência</li>
            <li>Currículo (arquivo PDF, DOC ou DOCX)</li>
            <li>Observações adicionais (campo opcional)</li>
          </ul>
          <p className="mt-3">
            <strong>Não coletamos</strong> CPF, RG, endereço completo, dados bancários,
            foto, data de nascimento, estado civil, dados de saúde ou qualquer informação
            sensível não relacionada à vaga.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Finalidade do tratamento</h2>
          <p>Seus dados são utilizados exclusivamente para:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Avaliação da candidatura para a(s) vaga(s) de interesse</li>
            <li>Contato para etapas do processo seletivo</li>
            <li>Composição de banco de talentos, quando houver consentimento específico</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Uso de Inteligência Artificial</h2>
          <p>
            Este portal utiliza a <strong>API da Anthropic (Claude)</strong> como ferramenta
            de apoio à triagem curricular. O texto extraído do currículo pode ser enviado
            a esta plataforma para geração de um resumo estruturado. O objetivo é apoiar —
            e nunca substituir — a avaliação humana do RH.
          </p>
          <p className="mt-2">
            A IA <strong>não toma decisões automáticas</strong> sobre aprovação ou reprovação
            de candidatos. Não são considerados dados sensíveis (gênero, raça, saúde, etc.) na análise.
            A decisão final é sempre do time de Gente &amp; Gestão.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Compartilhamento de dados</h2>
          <p>
            Seus dados não são vendidos, alugados ou comercializados. Podem ser compartilhados
            apenas com:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Gestores internos responsáveis pela vaga (somente candidatos pré-selecionados)</li>
            <li>Anthropic (Claude API) — para análise de currículo, conforme item 4</li>
            <li>Resend — plataforma de envio de e-mails transacionais</li>
            <li>Autoridades públicas, quando exigido por lei</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Prazo de retenção</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Candidaturas ativas: 1 ano após o encerramento da vaga</li>
            <li>Banco de talentos: 2 anos, com renovação de consentimento</li>
            <li>Candidatos reprovados: 6 meses após a decisão</li>
          </ul>
          <p className="mt-2">
            Após esses prazos, os dados são anonimizados ou excluídos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Seus direitos (LGPD)</h2>
          <p>Como titular de dados, você tem direito a:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Confirmar a existência de tratamento</li>
            <li>Acessar seus dados</li>
            <li>Corrigir dados incompletos ou desatualizados</li>
            <li>Solicitar anonimização, bloqueio ou eliminação</li>
            <li>Revogar consentimento a qualquer momento</li>
            <li>Opor-se ao tratamento em caso de descumprimento da LGPD</li>
          </ul>
          <p className="mt-3">
            Para exercer seus direitos, envie um e-mail para{" "}
            <strong>privacidade@wgbaterias.com.br</strong> informando seu nome e solicitação.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo:
            criptografia em trânsito (HTTPS), armazenamento em ambiente privado (sem acesso público),
            controle de acesso por autenticação e logs de auditoria de acesso interno.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contato</h2>
          <p>
            Dúvidas sobre privacidade? Entre em contato com nosso time de Gente &amp; Gestão:
            <br />
            <strong>privacidade@wgbaterias.com.br</strong>
          </p>
        </section>
      </div>
    </div>
  );
}
