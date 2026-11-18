# Seriesaholic

A TV show tracker with a real watch queue, shared auth across portfolio apps, and TV Time import — built as production software, not a tutorial clone.

Live app: [seriesaholic.daviandrade.dev](https://seriesaholic.daviandrade.dev)

---

## English

### What it does

- Keep a personal library of shows (watching, plan to watch, up to date, finished, dropped)
- Home queue that sorts shows by aired episodes you still need to watch
- Discover and search the TMDB catalog
- Open a show, mark one episode or a whole season
- Add a custom show when it is not on TMDB
- Import watch history from TV Time (GDPR zip, Liberator, or JSON)
- See watch-time stats, genres, and marathons
- Use Portuguese or English, light or dark theme
- Meet WCAG 2.2 AA on the main screens and dialogs

You can browse Discover and Search without an account. Saving a library, marking episodes, importing, and stats need a sign-in through the [auth hub](https://auth.daviandrade.dev) — the same account used by the other daviandrade.dev apps.

### Architecture decisions

Short notes on choices that matter when reading the code:

- **Shared auth hub.** Sessions live on `auth.daviandrade.dev` with better-auth. This app never owns passwords; it bootstraps from a one-time token and renews the cookie from the client because Server Components cannot write cookies safely.
- **Watch queue is domain logic.** “Watch now”, “Behind”, “Up to date”, and “Finished” come from aired vs watched counts plus a recent-activity window — not from a manual status alone. When a new episode airs, an up-to-date show leaves that bucket.
- **Import runs as jobs.** TV Time uploads become background import jobs with resolve/cancel paths, so a large GDPR zip does not block the request thread.
- **Bilingual data at rest.** Titles and synopses keep Portuguese and English columns so language switches do not refetch TMDB for the library.
- **Accessibility is tested.** jsx-a11y is strict and axe covers shell screens and dialogs in CI-related tests.

### Stack

Next.js 16, React 19, Tailwind CSS 4, Prisma, Neon PostgreSQL, TMDB, better-auth (shared with the auth hub), Vitest, GitHub Actions.

### Setup

```bash
pnpm install
cp .env.example .env
```

Fill `.env` with:

- Neon `DATABASE_URL` and `DIRECT_URL` (app library)
- `TMDB_API_KEY` from [TMDB API settings](https://www.themoviedb.org/settings/api)
- `AUTH_DATABASE_URL` and `BETTER_AUTH_SECRET` (same values as the auth hub)
- `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_AUTH_URL`
- Leave `BETTER_AUTH_COOKIE_DOMAIN` empty on localhost; use `.daviandrade.dev` in production

Then:

```bash
pnpm run db:setup
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`db:setup` runs migrations and seeds the catalog. Neon’s free compute can sleep; the `connect_timeout` values in `.env.example` help on cold start.

### Import from TV Time

1. Download your export from [TV Time GDPR self-service](https://gdpr.tvtime.com/gdpr/self-service)
2. Open **Import** in the app
3. Upload the `.zip`, a `.csv`, or a `.json`

### Useful scripts

| Command | What it does |
| --- | --- |
| `pnpm run dev` | Start the app locally |
| `pnpm test` | Run the test suite |
| `pnpm run lint` | Run ESLint |
| `pnpm run db:migrate` | Apply database migrations |
| `pnpm run db:seed` | Seed the catalog |
| `pnpm run db:setup` | Migrate and seed |
| `pnpm run db:refresh-aired` | Recount aired episodes in the library |
| `pnpm run db:backfill-english` | Fill English titles/synopses on existing rows |

CI on every push runs lint, TypeScript, and tests.

---

## Português

### O que faz

- Guarda uma biblioteca pessoal de séries (assistindo, quero ver, em dia, concluídas, abandonadas)
- Fila na home que ordena pelo que já foi ao ar e ainda falta assistir
- Descobrir e buscar no catálogo do TMDB
- Abrir uma série e marcar um episódio ou a temporada inteira
- Criar uma série manual quando ela não está no TMDB
- Importar o histórico do TV Time (ZIP do GDPR, Liberator ou JSON)
- Ver estatísticas de tempo, gêneros e maratonas
- Usar português ou inglês, tema claro ou escuro
- Seguir WCAG 2.2 AA nas telas principais e nos diálogos

Dá para explorar Descobrir e Buscar sem conta. Salvar biblioteca, marcar episódios, importar e ver estatísticas pedem login no [auth hub](https://auth.daviandrade.dev) — a mesma conta dos outros apps daviandrade.dev.

App no ar: [seriesaholic.daviandrade.dev](https://seriesaholic.daviandrade.dev)

### Decisões de arquitetura

Notas curtas sobre escolhas que importam ao ler o código:

- **Auth hub compartilhado.** As sessões ficam em `auth.daviandrade.dev` com better-auth. Este app não guarda senha; ele inicia a sessão com um token de uso único e renova o cookie no cliente, porque Server Component não grava cookie com segurança.
- **A fila é regra de domínio.** “Assistir agora”, “Atrasadas”, “Em dia” e “Finalizadas” saem da contagem ao ar vs assistido e de uma janela de atividade recente — não só de um status manual. Quando um episódio novo vai ao ar, a série sai de “Em dia”.
- **Importação em jobs.** O upload do TV Time vira job em background com resolve/cancel, para um ZIP grande do GDPR não travar a request.
- **Dados bilíngues no banco.** Títulos e sinopses guardam colunas em português e inglês para trocar o idioma sem refetch no TMDB.
- **Acessibilidade testada.** jsx-a11y estrito e axe nas telas e diálogos nos testes ligados ao CI.

### Stack

Next.js 16, React 19, Tailwind CSS 4, Prisma, Neon PostgreSQL, TMDB, better-auth (compartilhado com o auth hub), Vitest, GitHub Actions.

### Setup

```bash
pnpm install
cp .env.example .env
```

Preencha o `.env` com:

- `DATABASE_URL` e `DIRECT_URL` do Neon (biblioteca do app)
- `TMDB_API_KEY` em [configurações de API do TMDB](https://www.themoviedb.org/settings/api)
- `AUTH_DATABASE_URL` e `BETTER_AUTH_SECRET` (os mesmos do auth hub)
- `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_AUTH_URL`
- Deixe `BETTER_AUTH_COOKIE_DOMAIN` vazio no localhost; em produção use `.daviandrade.dev`

Depois:

```bash
pnpm run db:setup
pnpm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

`db:setup` aplica as migrations e popula o catálogo. O compute gratuito do Neon hiberna; o `connect_timeout` do `.env.example` ajuda no cold start.

### Importar do TV Time

1. Baixe o export em [TV Time GDPR self-service](https://gdpr.tvtime.com/gdpr/self-service)
2. Abra **Importar** no app
3. Envie o `.zip`, um `.csv` ou um `.json`

### Scripts úteis

| Comando | O que faz |
| --- | --- |
| `pnpm run dev` | Sobe o app local |
| `pnpm test` | Roda os testes |
| `pnpm run lint` | Roda o ESLint |
| `pnpm run db:migrate` | Aplica as migrations |
| `pnpm run db:seed` | Popula o catálogo |
| `pnpm run db:setup` | Migra e popula |
| `pnpm run db:refresh-aired` | Reconta episódios já ao ar na biblioteca |
| `pnpm run db:backfill-english` | Preenche títulos/sinopses em inglês nas linhas existentes |

O CI em todo push roda lint, TypeScript e testes.
