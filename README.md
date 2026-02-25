# Ebbinglish

A vocabulary learning web app that combines:
- **Round-driven mastery flow** (encounter + polish + freeze)
- **YouGlish video immersion** (learn words in real spoken context)
- **Google account login** (NextAuth/Auth.js)

## MVP
- Google login
- Word library (manual add + CSV import)
- Round/session review (Today) with 3-grade feedback: know / fuzzy / don’t know
- First-impression mastery state: consecutive perfect / freeze rounds / mastered
- YouGlish integration (link or embed) per word
- Basic stats (streak, active/frozen/mastered distribution, hardest words)

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
# Optional (Auth.js v5 aliases)
# AUTH_SECRET="<same-as-nextauth-secret>"
# AUTH_URL="http://localhost:3000"
# AUTH_TRUST_HOST="true"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
DICT_BACK_API="http://localhost:8787/v1"
DICT_BACK_API_DICT_ID="oxford-1"
OPENAI_API_KEY="sk-..."
# OPENAI_MODEL="gpt-4o-mini"
# OPENAI_BASE_URL="https://api.openai.com"
# DICT_BACK_API_KEY="..."
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
- Round pool strategy tuning
- Review UI (front/back, reveal meaning, grading)
- YouGlish integration per word
- Stats
