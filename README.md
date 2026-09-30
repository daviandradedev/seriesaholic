# SeriesAholic

Tracker de séries. A biblioteca funciona sem conta neste navegador. Entrar no [auth hub](https://auth.daviandrade.dev) guarda os dados na mesma conta dos outros apps.

## O que faz

- Biblioteca: assistindo, quero ver, em dia, concluídas e abandonadas
- Descobrir, buscar e calendário via TMDB
- Marcar episódio ou a temporada inteira
- Série manual
- Importação do TV Time (ZIP do GDPR, Liberator ou JSON)
- Estatísticas do tempo assistido
- Português e inglês, tema claro e escuro

Sem login, os dados ficam no cookie de convidado e somem quando a janela fecha. O login leva essa biblioteca para a conta.

## Stack

Next.js 16, React 19, Tailwind, Prisma e Neon PostgreSQL. Metadados no TMDB. Sessão com better-auth, o mesmo banco e o mesmo segredo do auth hub.

## Setup

```bash
pnpm install
cp .env.example .env
```

Preencha `.env` com o Neon (`DATABASE_URL` e `DIRECT_URL`), a chave do TMDB e as variáveis de auth. `AUTH_DATABASE_URL` e `BETTER_AUTH_SECRET` são os mesmos do hub. No localhost, `BETTER_AUTH_COOKIE_DOMAIN` fica vazio. Em `*.daviandrade.dev`, o domínio do cookie é `.daviandrade.dev`.

A chave do TMDB sai de https://www.themoviedb.org/settings/api.

```bash
pnpm run db:setup
pnpm run dev
```

Abra http://localhost:3000.

`pnpm run db:setup` aplica as migrations e popula o catálogo. O compute gratuito do Neon hiberna. `connect_timeout` de 30s no `.env.example` evita a falha de conexão no cold start.

## Importar o TV Time

1. Baixe o export em https://gdpr.tvtime.com/gdpr/self-service
2. Abra Importar
3. Envie o `.zip`, um `.csv` ou um `.json`

## Scripts

| Comando | Descrição |
| --- | --- |
| `pnpm run dev` | Servidor de desenvolvimento |
| `pnpm test` | Testes |
| `pnpm run db:migrate` | Aplica as migrations |
| `pnpm run db:seed` | Popula o catálogo |
| `pnpm run db:setup` | Migra e popula |
