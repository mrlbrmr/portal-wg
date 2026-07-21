// Todas as mensagens do bot em PT-BR.
// Manter em um arquivo centralizado facilita revisão de copy.

export const BOT = {
  greeting: (name?: string) =>
    `Olá${name ? `, ${name}` : ""}! 👋\n\nBem-vindo(a) ao processo de admissão digital da WG.\n\nVou guiar você no envio dos seus documentos pelo WhatsApp, de forma rápida e segura. O processo leva cerca de 5 minutos.\n\nDigite *Sim* para começar ou *Não* se recebeu esta mensagem por engano.`,

  askName: `Ótimo! Vamos começar. 😊\n\nPrimeiro, me informe seu *nome completo* (como está no RG/CNH):`,

  askCpf: (name: string) =>
    `Obrigado, *${name}*!\n\nAgora me informe seu *CPF* (apenas números):`,

  askBirthDate: `Ótimo! Agora me informe sua *data de nascimento* no formato *DD/MM/AAAA*:`,

  confirmPersonal: (name: string, cpf: string, birthDate: string) =>
    `Perfeito! Confirme seus dados:\n\n👤 *Nome:* ${name}\n🔢 *CPF:* ${cpf}\n📅 *Nascimento:* ${birthDate}\n\nEstá correto? Responda *Sim* para confirmar ou *Não* para corrigir.`,

  docRgCnh: `Agora vamos para os documentos! 📄\n\n*1/4 — RG ou CNH*\n\nEnvie uma *foto nítida* do seu RG (frente e verso em uma imagem) ou CNH. Certifique-se de que:\n• A foto esteja bem iluminada e sem reflexo\n• Todos os dados estejam legíveis\n• O documento não esteja cortado`,

  docCpfCard: `*2/4 — Cartão CPF*\n\nEnvie uma *foto* do seu cartão CPF ou da folha do CPF emitida pela Receita Federal.`,

  docAddress: `*3/4 — Comprovante de endereço*\n\nEnvie um comprovante de residência *dos últimos 3 meses* (conta de água, luz, gás, telefone ou extrato bancário).`,

  docPhoto: `*4/4 — Foto 3x4*\n\nEnvie sua *foto 3x4 recente* (fundo branco ou claro, rosto visível, sem óculos de sol ou boné).`,

  mediaReceived: `✅ Documento recebido! Estou validando...`,

  validationApproved: (docLabel: string) =>
    `✅ *${docLabel}* aprovado(a)!\n\n`,

  validationNeedsReview: (docLabel: string) =>
    `👍 *${docLabel}* recebido(a) e encaminhado(a) para revisão do RH.\n\n`,

  validationRejected: (reason: string) =>
    `❌ Não consegui validar o documento. ${reason}\n\nPor favor, envie novamente.`,

  maxRetriesExceeded: `Parece que estamos tendo dificuldades com este documento. O RH irá te contatar em breve para ajudar. 🙏`,

  done: `🎉 *Parabéns!* Todos os seus documentos foram enviados com sucesso!\n\nO time de RH irá analisá-los e entrará em contato para os próximos passos da sua admissão.\n\nBem-vindo(a) à família WG! 💚`,

  exception: `Identificamos uma situação que precisa de atenção manual. O RH irá entrar em contato com você em breve. Obrigado pela paciência! 🙏`,

  sessionExpired: `Esta sessão expirou (72 horas). Entre em contato com o RH para reiniciar o processo de admissão digital.`,

  unknownMessage: `Não entendi esta mensagem. Por favor, siga as instruções anteriores ou envie *Ajuda* para contato com o RH.`,

  notStarted: `Olá! Esta linha é usada para o processo de admissão digital da WG. Por favor, aguarde o convite do RH. 😊`,
}

export const DOC_LABELS: Record<string, string> = {
  RG_CNH: 'RG/CNH',
  CPF_CARD: 'Cartão CPF',
  ADDRESS_PROOF: 'Comprovante de endereço',
  PHOTO_3X4: 'Foto 3x4',
}

export const DOC_ORDER = ['RG_CNH', 'CPF_CARD', 'ADDRESS_PROOF', 'PHOTO_3X4'] as const
export type DocType = (typeof DOC_ORDER)[number]
