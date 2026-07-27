# Arbeitsjournal Tool

A workjournal web app for apprentices and their hosts, built as part of a trial
IPA. Apprentices document their work in a weekly calendar and
hosts get an overview of the work of every apprentice assigned to them.

**Live app: [workjournaltool.vercel.app](https://workjournaltool.vercel.app)**

## What it does

- **Weekly calendar** apprentices log their work as calendar entries with a
  title, time, description, work location and a color
- **Blockers & solutions** each entry can document one or more blockers, each
  with its own solution steps
- **Links** attach go, critique and buganizer links to an entry
- **Projects** group entries into projects (e.g "Apprentice day event") to see how much
  time went into each one, together with all its entries, blockers and links
- **Hosts** an apprentice invites a host by email, once accepted, the host can
  review that apprentice's calendar and projects

## How to use the website

1. **Create an account** at
   [workjournaltool.vercel.app](https://workjournaltool.vercel.app) with your
   email and password (or sign in with Google)
2. **Add calendar entries** on the calendar, drag over a time range (desktop)
   or tap a slot (mobile), or use the Create button. Fill in the details and
   save
3. **Organize with projects** open Projects, create a project with a name,
   color and icon, then pick that project when creating or editing an entry
4. **Share with your host** in Settings, add your host's email. Once they
   accept the invitation, they can see your calendar and projects.
5. As a **host**, open My apprentices to review each apprentice's calendar
   and projects

## Found a bug?

Please report it at **[/report-bug](https://workjournaltool.vercel.app/report-bug)**
(also linked from the sign-in page and the in-app menu)

---

## Development

The remainder of this file is for developers working on the app.

### Tech stack

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

### Getting started

Prerequisites: Node.js 20+, Docker Desktop.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env   # then adjust values (a random BETTER_AUTH_SECRET is required)

# 3. Start the local PostgreSQL database (and Mailpit for emails)
docker compose up -d

# 4. Apply database migrations
npm run db:migrate

# 5. Run the dev server
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000). Emails sent in
development are captured by Mailpit at [http://localhost:8025](http://localhost:8025).

#### Google sign-in (optional)

Email/password login works out of the box. To enable the "Sign in with Google"
button, create an OAuth client at the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) with
redirect URI `http://localhost:3000/api/auth/callback/google` and set
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests (Chromium) |
| `npm run test:e2e:firefox` | Playwright end-to-end tests (Firefox)* |
| `npm run db:generate` | Generate Drizzle migration from schema changes |
| `npm run db:migrate` | Apply migrations to the database |
| `npm run db:studio` | Open Drizzle Studio to inspect the database |

*Before the first e2e run, download the browsers with `npx playwright install chromium firefox`.
The Playwright Firefox build additionally requires the
[Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)
on Windows.

### Deployment (Vercel + Neon)

The app deploys as a standard Next.js project. Recommended free-tier setup:

#### 1. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech) and copy the Postgres
   connection string.
2. Apply the migrations once from your machine:
   ```bash
   DATABASE_URL="<neon connection string>" npm run db:migrate
   ```
   (PowerShell: `$env:DATABASE_URL="<...>"; npm run db:migrate`)

#### 2. App (Vercel)

1. Push this repository to GitHub and import it at
   [vercel.com/new](https://vercel.com/new) - the Next.js defaults are fine.
2. Set the environment variables in the Vercel project settings:

| Variable | Value in production |
| --- | --- |
| `DATABASE_URL` | Neon connection string |
| `BETTER_AUTH_SECRET` | Fresh random secret (`npx @better-auth/cli secret`) |
| `BETTER_AUTH_URL` | `https://<your-app>.vercel.app` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | From your mail provider (e.g. Resend or Brevo SMTP) |
| `MAIL_FROM` | e.g. `Arbeitsjournal Tool <noreply@yourdomain>` |

3. Deploy. Every merge to `main` deploys automatically afterwards.

#### 3. After the first deploy

- Google Cloud Console → your OAuth client → add the production redirect URI
  `https://<your-app>.vercel.app/api/auth/callback/google`.
- While the OAuth consent screen is in test mode, only accounts listed under
  *Zielgruppe → Testnutzer* can use Google sign-in; email/password login works
  for everyone.
- Email verification and host-invite emails only send once real `SMTP_*` values
  are configured; without them, verification is skipped and invitations are
  accepted in-app.

### Branching model

`main` is always stable. Each work package is developed on a `feat/...` branch
and merged into `main` via pull request once it works and its tests pass.
