import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de Privacidade",
  description: "Como o Grupo WG trata os dados pessoais dos candidatos em conformidade com a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <div className="py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-black/20 p-8 md:p-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Aviso de Privacidade
          </h1>
          <p className="text-xs text-gray-400 mb-2">
            Última atualização: Junho de 2026
          </p>
          <p className="text-xs text-gray-500 mb-10">
            Veja também nossos{" "}
            <Link href="/termos" className="text-wg-green underline hover:text-wg-green-dark">
              Termos de Uso e Política de Cookies
            </Link>
            .
          </p>

          <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                1. Quem somos
              </h2>
              <p>
                O <strong>Grupo WG</strong> é o controlador dos dados pessoais
                coletados neste portal de carreiras, em conformidade com a Lei
                Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                2. Dados coletados
              </h2>
              <p>
                Ao se candidatar a uma vaga, coletamos apenas os dados mínimos
                necessários ao processo seletivo:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Nome completo</li>
                <li>E-mail e telefone</li>
                <li>Cidade e estado de residência</li>
                <li>Currículo e informações específicas da vaga</li>
              </ul>
              <p className="mt-2 text-gray-500 text-xs">
                Não coletamos CPF, dados bancários, foto, dados de saúde ou
                qualquer informação sensível não relacionada à vaga.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                3. Finalidade
              </h2>
              <p>
                Seus dados são utilizados exclusivamente para a avaliação da
                candidatura e o contato nas etapas do processo seletivo.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                4. Compartilhamento
              </h2>
              <p>
                Seus dados não são vendidos ou comercializados. Podem ser
                acessados pelos gestores internos responsáveis pela vaga e pelas
                ferramentas de candidatura utilizadas pelo Grupo WG. Dados podem
                ser compartilhados com autoridades públicas quando exigido por lei.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                5. Retenção
              </h2>
              <p>
                Dados de candidaturas são retidos por até 1 ano após o
                encerramento da vaga, sendo excluídos em seguida.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                6. Seus direitos (LGPD)
              </h2>
              <p>
                Como titular de dados, você tem direito a confirmar o tratamento,
                acessar, corrigir, eliminar seus dados ou revogar o consentimento
                a qualquer momento. Para exercer seus direitos, entre em contato pelo e-mail{" "}
                <a href="mailto:privacidade@wgbaterias.com.br" className="text-wg-green underline hover:text-wg-green-dark">
                  privacidade@wgbaterias.com.br
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                7. Cookies e rastreamento
              </h2>
              <p>
                Utilizamos cookies essenciais para autenticação e segurança do portal, além de
                cookies de analytics (Vercel Speed Insights) apenas com seu consentimento explícito.
                O reCAPTCHA v3 do Google é usado para prevenir envios automatizados abusivos.
              </p>
              <p className="mt-2">
                Para informações completas sobre cada tipo de cookie utilizado, finalidades e como
                gerenciá-los, consulte nossa{" "}
                <Link href="/termos#cookies" className="text-wg-green underline hover:text-wg-green-dark">
                  Política de Cookies
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
