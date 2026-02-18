# Ebbinglish

A vocabulary learning web app that combines:
- **Ebbinghaus-style spaced repetition** (fixed review stages)
- **YouGlish video immersion** (learn words in real spoken context)
- **Google account login** (NextAuth/Auth.js)

## MVP
- Google login
- Word library (manual add + CSV import)
- Review queue (Today) with 3-grade feedback: know / fuzzy / don’t know
- Scheduling using fixed stages (configurable)
- YouGlish integration (link or embed) per word
- Basic stats (streak, due count, hardest words)

## Tech
- Next.js (App Router) + TypeScript + Tailwind
- NextAuth (Auth.js) + Google OAuth
- PostgreSQL + Prisma

## Local dev (requires more disk than this OpenClaw container)
This OpenClaw runtime has a small `/data` volume; installing `node_modules` may fail with ENOSPC.
Recommended: clone this repo to your own dev machine (or a bigger volume) and run installs there.

### 1) Environment
Create `.env`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/ebbinglish"
NEXTAUTH_SECRET="<random-32+>"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

Generate a secret:

```bash
openssl rand -base64 32
```

### 2) Install & migrate

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

### 3) Run

```bash
npm run dev
```

## Google OAuth setup
In Google Cloud Console:
- Create OAuth Client (Web)
- Authorized redirect URI:
  - `http://localhost:3000/api/auth/callback/google`

## Repo structure
- `app/` Next.js routes
- `src/auth.ts` NextAuth config
- `prisma/schema.prisma` DB schema

## TODO (next)
- Word CRUD + CSV import
- Review scheduler + due queue query
- Review UI (front/back, reveal meaning, grading)
- YouGlish integration per word
- Stats
