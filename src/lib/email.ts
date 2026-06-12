const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Carreiras WG Baterias";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "carreiras@wgbaterias.com.br";

interface ApplicationConfirmationData {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  jobCity: string;
}

export async function sendApplicationConfirmation(
  data: ApplicationConfirmationData
): Promise<void> {
  // Se não houver API key, loga e retorna sem erro (não bloqueia a candidatura)
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] RESEND_API_KEY não configurada. E-mail de confirmação não enviado.");
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: data.candidateEmail,
      subject: `Candidatura recebida — ${data.jobTitle}`,
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <div style="border-top: 4px solid #f97316; padding-top: 20px;">
            <h2 style="color: #1a1a1a;">Candidatura Recebida!</h2>
            <p>Olá, <strong>${data.candidateName}</strong>!</p>
            <p>Sua candidatura para a vaga de <strong>${data.jobTitle}</strong> em <strong>${data.jobCity}</strong> foi recebida com sucesso.</p>
            <p>Nossa equipe de Gente &amp; Gestão irá analisar seu perfil e, caso haja compatibilidade, entraremos em contato pelos dados informados.</p>
            <p style="color: #666; font-size: 14px;">Todas as candidaturas são tratadas com confidencialidade, em conformidade com a LGPD.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="font-size: 12px; color: #999;">
              Grupo WG / WG Baterias — Gente &amp; Gestão<br>
              Este é um e-mail automático. Não responda a esta mensagem.
            </p>
          </div>
        </body>
        </html>
      `,
    });
  } catch (error) {
    // Falha no e-mail não deve bloquear a candidatura
    console.error("[Email] Erro ao enviar confirmação:", error);
  }
}
