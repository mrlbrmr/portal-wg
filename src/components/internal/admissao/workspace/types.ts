import type { DigitalFormState } from "@/lib/admissao/overview";
import type { AdmissionRecord, Pendency } from "@/lib/admissao/workspace";

export interface Option {
  id: string;
  name: string;
}

export interface StageOption extends Option {
  color: string;
  isFinal: boolean;
}

/** Cadastros ATIVOS (mesma consulta dos formulários e filtros de Admissões). */
export interface WorkspaceOptions {
  stages: StageOption[];
  companies: Option[];
  branches: Option[];
  positions: Option[];
  users: Option[];
}

/** Dados serializáveis da ficha, montados no servidor (page.tsx). */
export interface AdmissionWorkspaceData {
  id: string;
  record: AdmissionRecord;
  /** Nomes GRAVADOS — incluem itens hoje inativos no cadastro (não somem da ficha). */
  saved: {
    positionName: string | null;
    companyName: string | null;
    branchName: string | null;
    stageName: string | null;
    stageColor: string | null;
    stageIsFinal: boolean;
    responsibleName: string | null;
  };
  /** "Hoje" (AAAA-MM-DD, fuso de São Paulo) calculado no servidor — mesmo valor na hidratação. */
  today: string;
  createdAt: string;
  updatedAt: string;
  form: {
    state: DigitalFormState;
    submittedAt: string | null;
    expiresAt: string | null;
    /** Última geração de link registrada no log (FORM_LINK_SENT). */
    lastSentAt: string | null;
    /** Link ativo (só quando há token válido) — copiar sem gerar outro. */
    currentUrl: string | null;
    expiryDays: number;
  };
  /** Respostas do formulário usadas em "Benefícios e recursos" (somente leitura). */
  answers: {
    needsTransportVoucher: boolean | null;
    transportVoucherDetails: string | null;
    hasItauAccount: boolean | null;
    noOperationalUniform: boolean | null;
    labels: { needsTransportVoucher: string; transportVoucherDetails: string; hasItauAccount: string };
  };
  origin: {
    job: { id: string; code: string | null; title: string } | null;
    candidateHref: string | null;
  };
  docs: { requiredTotal: number; requiredDone: number; attention: number };
  pendencies: Pendency[];
  historyCount: number;
}
