# CLAUDE.md — Portal de Vagas WG Baterias

Orientação para o Claude Code neste repositório. **Este arquivo é commitado e carregado
automaticamente em qualquer notebook** que baixe o projeto do GitHub. Histórico detalhado
e decisões: [`docs/DESENVOLVIMENTO.md`](docs/DESENVOLVIMENTO.md). Instalação: [`INSTALACAO.md`](INSTALACAO.md).

## O que é
Portal de carreiras + ATS (recrutamento) + Admissões + Avaliações/Testes da WG Baterias.
Produção: **carreiras.wgbaterias.com.br** (deploy na Vercel).

## Stack
- **Next.js 15** (App Router) · React 19 · TypeScript · Tailwind 3
- **Supabase** (Postgres + Auth + Storage) — acesso a dados em runtime é via **`supabase-js`**
- `@anthropic-ai/sdk` (validação de documentos e geração de testes por IA); `exceljs`, `resend`, `@dnd-kit`, `tiptap`, `zod`
- ⚠️ **`prisma/schema.prisma` é APENAS documentação do schema.** Não há Prisma client em runtime
  (não existe dependência `prisma`/`@prisma/client`; `src/lib/prisma.ts` foi removido na migração
  para o Supabase). A **fonte de verdade do schema são as migrações SQL** em `supabase/migrations/`.

## Autorização (RLS no banco, não no app)
- Papéis (claim JWT `app_metadata.user_role`): **ADMIN_RH** (escreve) e **VIEWER_RH** (só lê).
- Policies padrão: `is_staff()` lê o interno; `is_admin()` escreve. Helpers em `supabase/migrations/20260720000001_rls.sql`.
- Clients: `@/lib/supabase/server` (sessão do usuário, respeita RLS — use na maioria dos casos) ·
  `@/lib/supabase/admin` (service-role, ignora RLS — só para POST público de candidatura, feeds e webhooks).

## Comandos
- Dev: `npm run dev`
- **Type-check** (gate principal de validação): `node_modules/.bin/tsc --noEmit -p tsconfig.json`
- Lint: `npm run lint` — ⚠️ abre setup interativo de ESLint se não configurado; prefira o type-check.

## Deploy
- **Push em `master` → deploy de produção automático na Vercel** (integração GitHub; não há `vercel.json` nem `.vercel/`).

## Migrações de banco (LER ANTES DE MEXER NO SCHEMA)
- Arquivos SQL em `supabase/migrations/` (nome `AAAAMMDDHHMMSS_descricao.sql`).
- **Aplicadas à mão** (não rodam no deploy):
  `SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs supabase/migrations/<arquivo>.sql <versao>`
  (registra em `supabase_migrations.schema_migrations`). A `SUPABASE_DB_URL` é fornecida pelo usuário.
- **Ordem segura:** aplique migrações **aditivas ANTES de dar push**. Durante o build da Vercel o código
  antigo ainda está no ar; uma migração aditiva (add coluna/tabela) não o quebra. Só depois faça push.
  Evite migrações destrutivas (drop coluna) sem coordenar — quebram o código antigo durante o build.

## Mapa de módulos (`src/app/(internal)` = interno · `src/app/(public)` = público)
- **Admissões:** `src/app/(internal)/admissoes/**`, `src/lib/admissao/**`, `src/components/internal/admissao/**`
- **Modelos de checklist:** `.../admissoes/configuracoes/modelos`, `src/lib/admissao/template-actions.ts`, `checklist.ts`
- **ATS / Vagas:** `src/app/(internal)/vagas/**` (kanban de candidatos, funil configurável)
- **Avaliações / Testes:** `src/app/(internal)/avaliacoes/banco`, `src/lib/avaliacoes/**`
  (Fase 1 = Banco de Testes, **feito**; **Fase 2 = fluxo de sessão/candidato, PENDENTE** — ver doc)
- **Admissão digital (candidato, por token):** `src/app/admissao/[token]`, `src/app/api/admissao/[token]/**`

## Convenções
- Mutações internas = **Server Actions** (revalidam a página com `revalidatePath`); uploads (>1 MB) e
  fluxos públicos = **API routes**.
- Reordenação: setas ↑↓ (server actions que trocam `sortOrder`) ou drag-and-drop nativo do HTML5.
- Commits: `tipo(escopo): descrição` em português.
