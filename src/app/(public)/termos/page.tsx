import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso e Política de Cookies",
  description:
    "Conheça as condições de uso do portal de carreiras WG Baterias e saiba como utilizamos cookies.",
};

export default function TermosPage() {
  return (
    <div className="py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-black/20 p-8 md:p-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Termos de Uso e Política de Cookies
          </h1>
          <p className="text-xs text-gray-400 mb-2">
            Versão 1.0 — Vigente desde julho de 2026
          </p>
          <p className="text-xs text-gray-500 mb-10">
            Veja também nosso{" "}
            <Link href="/privacidade" className="text-wg-green underline hover:text-wg-green-dark">
              Aviso de Privacidade
            </Link>{" "}
            completo.
          </p>

          <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
            {/* ── 1. Identificação do Controlador ─────────────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                1. Identificação do Controlador
              </h2>
              <p>
                Este portal de carreiras é operado pela <strong>WG Baterias S.A.</strong> (doravante
                "WG Baterias" ou "nós"), pessoa jurídica de direito privado responsável pelo
                tratamento de dados pessoais coletados neste ambiente, na qualidade de{" "}
                <strong>controladora</strong>, nos termos da Lei Geral de Proteção de Dados Pessoais
                (LGPD — Lei nº 13.709/2018).
              </p>
            </section>

            {/* ── 2. Objetivo do Portal ───────────────────────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                2. Objetivo do Portal
              </h2>
              <p>
                O portal tem a finalidade exclusiva de divulgar vagas de emprego da WG Baterias e
                receber candidaturas de pessoas interessadas em fazer parte do nosso time. Ao usar
                este portal, o candidato concorda com os termos descritos neste documento.
              </p>
              <p className="mt-2">
                O acesso ao portal é gratuito e não cria qualquer vínculo empregatício ou
                obrigação de contratação entre o candidato e a WG Baterias.
              </p>
            </section>

            {/* ── 3. Dados Coletados e Bases Legais ───────────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                3. Dados Coletados e Bases Legais (LGPD)
              </h2>
              <p>Coletamos apenas os dados mínimos necessários ao processo seletivo:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Nome completo, e-mail e telefone — para identificação e contato</li>
                <li>Currículo (PDF, DOC ou DOCX) — para avaliação do perfil profissional</li>
                <li>
                  Endereço IP e data/hora do aceite — para registro de consentimento (art. 7º, I, LGPD)
                </li>
              </ul>
              <p className="mt-3 text-gray-500 text-xs">
                Não coletamos CPF, dados bancários, foto, dados de saúde ou qualquer informação
                sensível (art. 5º, II) não relacionada à seleção.
              </p>
              <p className="mt-3">
                <strong>Base legal principal:</strong> consentimento livre, informado e inequívoco
                do titular (art. 7º, I). O consentimento pode ser revogado a qualquer tempo
                mediante solicitação ao canal indicado na seção 8.
              </p>
              <p className="mt-2">
                <strong>Base legal complementar:</strong> legítimo interesse da WG Baterias em
                conduzir processos seletivos e garantir a segurança do portal (art. 7º, IX),
                observados os direitos e expectativas do titular.
              </p>
            </section>

            {/* ── 4. Cookies e Tecnologias de Rastreamento ────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                4. Cookies e Tecnologias de Rastreamento
              </h2>
              <p>
                Utilizamos cookies e tecnologias similares para garantir o funcionamento correto do
                portal e, com seu consentimento, para medir o desempenho das páginas. Os tipos de
                cookies utilizados são:
              </p>

              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="font-medium text-gray-900 mb-1">
                    Cookies Essenciais{" "}
                    <span className="text-xs font-normal text-gray-500">(sempre ativos)</span>
                  </p>
                  <p className="text-xs text-gray-600">
                    Necessários para o funcionamento básico do portal — autenticação de sessão
                    administrativa, proteção contra CSRF e comunicação segura com o banco de dados.
                    Sem esses cookies o portal não funciona. Base legal: legítimo interesse (art. 7º, IX).
                  </p>
                  <ul className="mt-2 text-xs text-gray-500 list-disc pl-4 space-y-0.5">
                    <li>
                      <code>next-auth.session-token</code> — sessão do painel administrativo
                    </li>
                    <li>
                      <code>next-auth.csrf-token</code> — proteção contra falsificação de requisição
                    </li>
                    <li>
                      <code>sb-*-auth-token</code> — autenticação Supabase (painel interno)
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="font-medium text-gray-900 mb-1">
                    Cookies de Segurança{" "}
                    <span className="text-xs font-normal text-gray-500">(sempre ativos)</span>
                  </p>
                  <p className="text-xs text-gray-600">
                    Utilizamos o reCAPTCHA v3 do Google para proteger o formulário de candidatura
                    contra bots e envios automatizados abusivos. O reCAPTCHA deposita cookies
                    próprios do Google e coleta informações de interação com a página para calcular
                    uma pontuação de risco. Consulte a{" "}
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Política de Privacidade do Google
                    </a>
                    . Base legal: legítimo interesse — segurança do portal (art. 7º, IX).
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="font-medium text-gray-900 mb-1">
                    Cookies de Analytics{" "}
                    <span className="text-xs font-normal text-gray-500">(somente com seu consentimento)</span>
                  </p>
                  <p className="text-xs text-gray-600">
                    Com seu consentimento, utilizamos o <strong>Vercel Speed Insights</strong> para
                    coletar métricas agregadas e anônimas de desempenho das páginas (Core Web Vitals),
                    sem identificar usuários individualmente. Nenhuma informação pessoal é enviada a
                    terceiros por meio destes cookies. Você pode recusar na preferência de cookies
                    exibida na primeira visita. Base legal: consentimento (art. 7º, I).
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-500">
                Você pode gerenciar ou excluir cookies a qualquer momento pelas configurações do
                seu navegador. A recusa de cookies essenciais pode impedir o uso de algumas
                funcionalidades do portal.
              </p>
            </section>

            {/* ── 5. Retenção e Descarte ──────────────────────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                5. Retenção e Descarte
              </h2>
              <p>
                Dados de candidaturas são retidos por até <strong>1 (um) ano</strong> após o
                encerramento da vaga correspondente, sendo excluídos automaticamente em seguida,
                salvo obrigação legal de guarda por prazo maior ou exercício de direito em processo
                judicial, administrativo ou arbitral (art. 16, LGPD).
              </p>
              <p className="mt-2">
                Currículos armazenados são excluídos da infraestrutura de nuvem no mesmo prazo.
              </p>
            </section>

            {/* ── 6. Compartilhamento ─────────────────────────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                6. Compartilhamento de Dados
              </h2>
              <p>
                Seus dados não são vendidos, alugados ou cedidos a terceiros para fins comerciais.
                Eles podem ser acessados por:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  Colaboradores internos da área de Gente &amp; Gestão responsáveis pela vaga
                </li>
                <li>
                  Operadores de infraestrutura (Supabase, Vercel) que processam dados em nosso nome
                  sob obrigação contratual de confidencialidade
                </li>
                <li>
                  Autoridades públicas, quando exigido por determinação legal ou judicial
                </li>
              </ul>
            </section>

            {/* ── 7. Direitos do Titular ──────────────────────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                7. Direitos do Titular (LGPD — art. 18)
              </h2>
              <p>Como titular de dados pessoais, você tem direito a:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  <strong>Confirmação e acesso</strong> — saber se tratamos seus dados e obter uma
                  cópia
                </li>
                <li>
                  <strong>Correção</strong> — solicitar a atualização de dados incompletos ou
                  inexatos
                </li>
                <li>
                  <strong>Eliminação</strong> — pedir a exclusão dos dados tratados com base em
                  consentimento
                </li>
                <li>
                  <strong>Portabilidade</strong> — receber seus dados em formato estruturado
                </li>
                <li>
                  <strong>Revogação do consentimento</strong> — retirar o aceite a qualquer momento,
                  sem prejuízo do tratamento realizado anteriormente
                </li>
                <li>
                  <strong>Oposição</strong> — opor-se a tratamento realizado em descumprimento da LGPD
                </li>
              </ul>
              <p className="mt-3">
                Para exercer qualquer destes direitos, entre em contato pelo canal informado na
                seção 8.
              </p>
            </section>

            {/* ── 8. Contato / DPO ────────────────────────────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                8. Canal de Contato — Encarregado de Dados (DPO)
              </h2>
              <p>
                Para exercer seus direitos, solicitar informações sobre o tratamento de dados ou
                registrar reclamação, entre em contato com nosso Encarregado de Proteção de Dados:
              </p>
              <p className="mt-2 font-medium">
                E-mail:{" "}
                <a
                  href="mailto:privacidade@wgbaterias.com.br"
                  className="text-wg-green underline hover:text-wg-green-dark"
                >
                  privacidade@wgbaterias.com.br
                </a>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Respondemos dentro de 15 dias úteis, conforme art. 18, § 3º, LGPD. Caso não
                satisfeito, você pode encaminhar reclamação à Autoridade Nacional de Proteção de
                Dados (ANPD) em{" "}
                <a
                  href="https://www.gov.br/anpd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  www.gov.br/anpd
                </a>
                .
              </p>
            </section>

            {/* ── 9. Alterações nesta Política ────────────────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                9. Alterações nesta Política
              </h2>
              <p>
                Esta política pode ser atualizada para refletir mudanças legais, tecnológicas ou
                operacionais. Quando houver alterações relevantes, publicaremos uma nova versão
                nesta página com a data de vigência atualizada. Recomendamos consultar
                periodicamente.
              </p>
              <p className="mt-2">
                O uso contínuo do portal após a publicação de uma nova versão implica aceitação das
                condições atualizadas.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
