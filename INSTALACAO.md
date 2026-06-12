# Portal de Carreiras — WG Baterias
## Guia de Instalação e Configuração

---

## Pré-requisitos

- Node.js 22 LTS ou superior → https://nodejs.org
- Conta no Neon (banco PostgreSQL gratuito) → https://neon.tech
- Conta no Vercel (deploy gratuito) → https://vercel.com
- Conta no Resend (e-mails — plano gratuito) → https://resend.com
- Conta na Anthropic (Claude API) → https://console.anthropic.com

---

## 1. Instalar dependências

```bash
npm install
```

---

## 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo:
```bash
# Windows:
copy .env.local.example .env.local

# Mac/Linux:
cp .env.local.example .env.local
```

Edite o `.env.local` com seus valores:

### DATABASE_URL (Neon)
1. Acesse https://neon.tech e crie um projeto
2. Copie a "Connection string" (formato postgresql://...)
3. Cole em DATABASE_URL no .env.local

### NEXTAUTH_SECRET
Gere uma string aleatória segura:
```bash
# Windows PowerShell:
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Mac/Linux:
openssl rand -base64 32
```

### ANTHROPIC_API_KEY
1. Acesse https://console.anthropic.com
2. Vá em API Keys → Create Key
3. Cole em ANTHROPIC_API_KEY

### RESEND_API_KEY
1. Acesse https://resend.com
2. Settings → API Keys → Create API Key
3. Cole em RESEND_API_KEY
4. Configure também RESEND_FROM_EMAIL com um e-mail verificado no Resend

---

## 3. Configurar o banco de dados

```bash
# Criar as tabelas no banco
npm run db:push

# (Opcional) Abrir o Prisma Studio para visualizar os dados
npm run db:studio
```

---

## 4. Criar dados iniciais (seed)

```bash
npm run db:seed
```

Isso criará:
- Usuário Admin RH: `admin@wgbaterias.com.br` / senha: `admin123`
- Usuário Visualizador: `visualizador@wgbaterias.com.br` / senha: `viewer123`
- 2 vagas de exemplo

⚠️ **IMPORTANTE**: Troque as senhas após o primeiro login!

---

## 5. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse:
- Portal público: http://localhost:3000
- Painel RH: http://localhost:3000/login
- Prisma Studio: http://localhost:5555 (se rodando `npm run db:studio`)

---

## 6. Deploy em produção (Vercel)

1. Suba o código para um repositório GitHub **privado**
2. Acesse https://vercel.com → New Project → importe o repositório
3. Em "Environment Variables", adicione todas as variáveis do `.env.local`
4. Altere `NEXTAUTH_URL` para a URL de produção (ex: https://carreiras.wgbaterias.com.br)
5. Deploy!

### Conectar domínio personalizado
1. No Vercel: Settings → Domains → Add Domain
2. Adicione: `carreiras.wgbaterias.com.br`
3. No provedor de DNS da WG Baterias, crie um registro CNAME:
   - Nome: `carreiras`
   - Valor: `cname.vercel-dns.com`
4. Aguarde propagação (até 48h)

---

## 7. Criar primeiro usuário Admin (produção)

Após o deploy, acesse o Neon Console → SQL Editor e execute:

```sql
-- Substitua a senha pelo hash gerado com bcrypt
-- Para gerar o hash, use: https://bcrypt-generator.com (cost factor 12)
INSERT INTO users (id, name, email, "passwordHash", role, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Nome do Admin',
  'admin@wgbaterias.com.br',
  '$2a$12$HASH_GERADO_AQUI',
  'ADMIN_RH',
  true,
  NOW(),
  NOW()
);
```

---

## 8. Checklist pré-produção

- [ ] HTTPS configurado (Vercel fornece automaticamente)
- [ ] `.env.local` NÃO commitado no Git
- [ ] Repositório configurado como **privado**
- [ ] Senhas do seed foram trocadas ou seed não foi executado em produção
- [ ] ANTHROPIC_API_KEY válida e com créditos
- [ ] RESEND_FROM_EMAIL verificado na plataforma Resend
- [ ] NEXTAUTH_URL = URL de produção real
- [ ] NEXTAUTH_SECRET = string longa e aleatória
- [ ] Backup automático do banco configurado (o Neon faz isso por padrão)
- [ ] Domínio `carreiras.wgbaterias.com.br` configurado no DNS
- [ ] Aviso de Privacidade revisado pelo jurídico/DPO da empresa
- [ ] E-mail `privacidade@wgbaterias.com.br` configurado e monitorado

---

## Estrutura de pastas relevante

```
portal-vagas/
├── prisma/schema.prisma     → Modelos do banco de dados
├── src/app/(public)/        → Páginas públicas (vagas, formulário)
├── src/app/(internal)/      → Painel interno do RH
├── src/app/api/             → API Routes (backend)
├── src/lib/                 → Utilitários (auth, Claude, email, storage)
├── src/components/          → Componentes React
├── uploads/                 → Currículos (privado, nunca publicar)
├── .env.local               → Variáveis de ambiente (NÃO commitar)
└── .env.local.example       → Modelo para configuração
```

---

## Comandos úteis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run db:push      # Aplicar schema ao banco (sem migration)
npm run db:migrate   # Criar migration formal
npm run db:studio    # Interface visual do banco de dados
npm run db:seed      # Popular banco com dados de exemplo
npm run lint         # Verificar erros de código
```
