export type TalentoStatus =
  | 'ATIVO'
  | 'EM_PROCESSO'
  | 'CONTRATADO'
  | 'NAO_ADERENTE'
  | 'ARQUIVADO';

export type TalentoOrigem =
  | 'CANDIDATURA_ESPONTANEA'
  | 'VAGA_ESPECIFICA'
  | 'INDICACAO'
  | 'IMPORTACAO';

export interface TalentoTag {
  id: string;
  nome: string;
  cor: string;
}

export interface Talento {
  id: string;
  nomeCompleto: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  cargoDesejado: string | null;
  pretensaoSalarial: number | null;
  linkedinUrl: string | null;
  curriculoUrl: string | null;
  curriculoNome: string | null;
  resumoProfissional: string | null;
  origem: TalentoOrigem;
  statusBanco: TalentoStatus;
  consentimentoLgpdEm: string | null;
  consentimentoValidadeAte: string | null;
  ultimaAtividadeEm: string;
  createdAt: string;
  updatedAt: string;
}

export interface TalentoListItem extends Pick<Talento,
  | 'id' | 'nomeCompleto' | 'email' | 'telefone'
  | 'cidade' | 'estado' | 'cargoDesejado'
  | 'statusBanco' | 'ultimaAtividadeEm' | 'createdAt'
> {
  tags: TalentoTag[];
}

export type TesteValidezResult =
  | { valido: true; validoAte: Date; diasRestantes: number }
  | {
      valido: false;
      motivo: 'nunca_realizado' | 'invalidado_pelo_rh' | 'expirado';
      expirouEm?: Date;
    };

export interface TesteSessionItem {
  id: string;
  templateId: string;
  templateNome: string;
  templateKind: string;
  submittedAt: string | null;
  score: number | null;
  outcome: string | null;
  scoreBreakdown: Record<string, unknown> | null;
  validoAte: string | null;
  invalidadoEm: string | null;
  invalidadoPorId: string | null;
  motivoInvalidacao: string | null;
  createdAt: string;
}

export interface TesteCard {
  templateId: string;
  templateNome: string;
  templateKind: string;
  validityMonths: number;
  validez: TesteValidezResult;
  sessoes: TesteSessionItem[];
}

export interface TalentoNote {
  id: string;
  talentoId: string;
  autorId: string;
  autorNome: string | null;
  conteudo: string;
  createdAt: string;
}

export interface CandidaturaHistorico {
  id: string;
  jobId: string;
  jobTitle: string;
  jobCity: string | null;
  stageId: string;
  stageName: string;
  stageKind: string;
  createdAt: string;
}

export interface TalentoProfile extends Talento {
  tags: TalentoTag[];
  testes: TesteCard[];
  candidaturas: CandidaturaHistorico[];
  notas: TalentoNote[];
}
