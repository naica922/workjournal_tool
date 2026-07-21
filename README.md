# Arbeitsjournal Tool

A work-journal web app for apprentices (Lernende) and their hosts, built as part of
a trial IPA at Google Switzerland. Learners document their work in a weekly
calendar; hosts get an overview of the calendars of all learners assigned to them.

## Tech stack

| Technology | Purpose |
| --- | --- |
| Next.js (React) + TypeScript | Frontend framework incl. server functions |
| Material Web Components (Material 3) | UI components and design |
| TanStack Query | Data fetching, caching, invalidation |
| FullCalendar | Week calendar view |
| PostgreSQL | Relational database |
| Drizzle ORM | Database access and migrations |
| Better Auth | Authentication (email/password + Google) and roles |
| Vitest | Unit tests |
| Playwright | Integration / end-to-end tests |

## Getting started

Prerequisites: Node.js 20+, Docker Desktop.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env   # then adjust values (a random BETTER_AUTH_SECRET is required)

# 3. Start the local PostgreSQL database
docker compose up -d

# 4. Apply database migrations
npm run db:migrate

# 5. Run the dev server
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Google sign-in (optional)

Email/password login works out of the box. To enable the "Sign in with Google"
button, create an OAuth client at the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) with
redirect URI `http://localhost:3000/api/auth/callback/google` and set
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest unit tests |
| `npm run db:generate` | Generate Drizzle migration from schema changes |
| `npm run db:migrate` | Apply migrations to the database |
| `npm run db:studio` | Open Drizzle Studio to inspect the database |

## Branching model

`main` is always stable. Each work package is developed on a `feat/...` branch
and merged into `main` via pull request once it works and its tests pass.
