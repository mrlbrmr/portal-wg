// Tipos da validade de testes do talento (validity.ts). Os tipos do Banco de Talentos
// (listagem, perfil, situação) vivem em crm.ts, list.ts e profile.ts.

export type TesteValidezResult =
  | { valido: true; validoAte: Date; diasRestantes: number }
  | {
      valido: false;
      motivo: 'nunca_realizado' | 'invalidado_pelo_rh' | 'expirado';
      expirouEm?: Date;
    };
