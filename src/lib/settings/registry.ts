// Mapa da área de Configurações: seções, páginas e cadastros.
//
// Fonte única para a home (/configuracoes), os breadcrumbs e a navegação interna de
// Cadastros. Só entra aqui o que existe de fato no sistema — nada de card vazio.

import {
  Briefcase,
  Building2,
  ClipboardList,
  FileStack,
  FileText,
  Globe,
  KanbanSquare,
  LayoutTemplate,
  Linkedin,
  ListChecks,
  MapPin,
  Tag,
  type LucideIcon,
} from "lucide-react";

export const SETTINGS_ROOT = { label: "Configurações", href: "/configuracoes" } as const;

export interface SettingsItem {
  /** Chave usada no registro de alterações (config_change_log.module). */
  key: string;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface SettingsSection {
  key: string;
  label: string;
  items: SettingsItem[];
}

// ─── Cadastros ────────────────────────────────────────────────────────────────

export type RegistryEntity = "position" | "company" | "branch" | "documentType" | "tag";

export interface RegistryDef extends SettingsItem {
  entity: RegistryEntity | "stage";
  /** Rótulos no singular/plural para textos de ação e contagem. */
  singular: string;
  plural: string;
  /** Artigo do singular ("o cargo", "a filial"). */
  article: "o" | "a";
}

export const REGISTRIES: RegistryDef[] = [
  {
    key: "cadastros.cargos",
    entity: "position",
    href: "/configuracoes/cadastros/cargos",
    title: "Cargos",
    description: "Cargos usados nas admissões e nos modelos de checklist.",
    icon: Briefcase,
    singular: "cargo",
    plural: "cargos",
    article: "o",
  },
  {
    key: "cadastros.empresas",
    entity: "company",
    href: "/configuracoes/cadastros/empresas",
    title: "Empresas",
    description: "Empresas do grupo que aparecem na ficha de admissão.",
    icon: Building2,
    singular: "empresa",
    plural: "empresas",
    article: "a",
  },
  {
    key: "cadastros.filiais",
    entity: "branch",
    href: "/configuracoes/cadastros/filiais",
    title: "Filiais",
    description: "Filiais e unidades onde o colaborador vai trabalhar.",
    icon: MapPin,
    singular: "filial",
    plural: "filiais",
    article: "a",
  },
  {
    key: "cadastros.etapas-admissao",
    entity: "stage",
    href: "/configuracoes/cadastros/etapas-admissao",
    title: "Etapas da admissão",
    description: "Colunas do quadro de admissões e a etapa de conclusão.",
    icon: KanbanSquare,
    singular: "etapa",
    plural: "etapas",
    article: "a",
  },
  {
    key: "cadastros.tipos-documento",
    entity: "documentType",
    href: "/configuracoes/cadastros/tipos-documento",
    title: "Tipos de documento",
    description: "Categorias dos anexos e quais contam para a ficha completa.",
    icon: FileStack,
    singular: "tipo de documento",
    plural: "tipos de documento",
    article: "o",
  },
  {
    key: "cadastros.tags",
    entity: "tag",
    href: "/configuracoes/cadastros/tags",
    title: "Tags",
    description: "Etiquetas coloridas para organizar as admissões e o Banco de Talentos.",
    icon: Tag,
    singular: "tag",
    plural: "tags",
    article: "a",
  },
];

export function getRegistry(entity: RegistryDef["entity"]): RegistryDef {
  const def = REGISTRIES.find((r) => r.entity === entity);
  if (!def) throw new Error(`Cadastro desconhecido: ${entity}`);
  return def;
}

// ─── Seções da home ───────────────────────────────────────────────────────────

export const CADASTROS: SettingsItem = {
  key: "cadastros",
  href: "/configuracoes/cadastros",
  title: "Cadastros",
  description: "Cargos, empresas, filiais, tipos de documento, tags e etapas.",
  icon: ListChecks,
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    key: "portal",
    label: "Portal de carreiras",
    items: [
      {
        key: "homepage",
        href: "/configuracoes/homepage",
        title: "Aparência da homepage",
        description: "Título e subtítulo da seção de vagas, filtros e contador.",
        icon: Globe,
      },
      {
        key: "homepage.cards",
        href: "/configuracoes/homepage/vagas",
        title: "Exibição das vagas",
        description: "Informações que aparecem nos cards de vaga para o candidato.",
        icon: LayoutTemplate,
      },
    ],
  },
  {
    key: "recrutamento",
    label: "Recrutamento",
    items: [
      {
        key: "formulario-vaga",
        href: "/configuracoes/formulario-vaga",
        title: "Solicitação de vaga",
        description: "Campos que os gestores preenchem ao pedir uma contratação.",
        icon: ClipboardList,
      },
      {
        key: "funil",
        href: "/configuracoes/funil",
        title: "Funil de seleção",
        description: "Etapas dos processos seletivos, testes vinculados e automações.",
        icon: KanbanSquare,
      },
    ],
  },
  {
    key: "admissao",
    label: "Admissão",
    items: [
      {
        key: "formulario-admissao",
        href: "/configuracoes/formulario-admissao",
        title: "Formulário de Admissão Digital",
        description: "Textos, perguntas, documentos e regras do formulário do candidato.",
        icon: FileText,
      },
      {
        ...getRegistry("stage"),
        title: "Fluxo de admissão",
        description: "Etapas do quadro de admissões e a etapa de conclusão.",
      },
    ],
  },
  {
    key: "cadastros",
    label: "Cadastros",
    items: REGISTRIES.filter((r) => r.entity !== "stage"),
  },
  {
    key: "integracoes",
    label: "Integrações",
    items: [
      {
        key: "divulgacao",
        href: "/configuracoes/divulgacao",
        title: "LinkedIn",
        description: "Conexão com a página da empresa para divulgar as vagas.",
        icon: Linkedin,
      },
    ],
  },
];
