# Database Schema

This document describes the current PostgreSQL schema used by Ebbinglish.

Source of truth:
- [prisma/schema.prisma](/Users/fangxingzhou/dev/ebbinglish/prisma/schema.prisma)

Schema scope:
- Auth.js authentication tables
- vocabulary library tables
- review state and review logs
- round/session study tables
- external API token table

## Overview

Core entities:
- `User`: application user
- `Word`: vocabulary item owned by a user
- `ReviewState`: long-term learning state for one word
- `ReviewLog`: per-review event log
- `StudyRound`: a round of selected words
- `StudySession`: one review session inside a round
- `StudySettings`: per-user study preferences
- `ApiToken`: hashed token for extension/external API access

Auth.js entities:
- `Account`
- `Session`
- `VerificationToken`

## Tables

### `User`

Purpose:
- stores the app user and top-level ownership for all user data

Columns:
- `id` `TEXT` primary key, default `cuid()`
- `name` `TEXT NULL`
- `email` `TEXT NULL`, unique
- `emailVerified` `TIMESTAMP NULL`
- `image` `TEXT NULL`
- `currentGlobalRound` `INTEGER NOT NULL DEFAULT 1`
- `createdAt` `TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt` `TIMESTAMP NOT NULL`, auto-updated by Prisma

Relations:
- one-to-many: `Account`
- one-to-many: `Session`
- one-to-many: `Word`
- one-to-many: `ReviewState`
- one-to-many: `ReviewLog`
- one-to-many: `StudyRound`
- one-to-many: `StudySession`
- one-to-one optional: `StudySettings`
- one-to-many: `ApiToken`

Indexes and constraints:
- primary key: `id`
- unique: `email`

### `Account`

Purpose:
- Auth.js OAuth account mapping table

Columns:
- `id` `TEXT` primary key, default `cuid()`
- `userId` `TEXT NOT NULL`
- `type` `TEXT NOT NULL`
- `provider` `TEXT NOT NULL`
- `providerAccountId` `TEXT NOT NULL`
- `refresh_token` `TEXT NULL`
- `access_token` `TEXT NULL`
- `expires_at` `INTEGER NULL`
- `token_type` `TEXT NULL`
- `scope` `TEXT NULL`
- `id_token` `TEXT NULL`
- `session_state` `TEXT NULL`

Relations:
- many-to-one: `User` via `userId`

Indexes and constraints:
- primary key: `id`
- unique: (`provider`, `providerAccountId`)
- foreign key: `userId -> User.id` with `ON DELETE CASCADE`

### `Session`

Purpose:
- Auth.js session table

Columns:
- `id` `TEXT` primary key, default `cuid()`
- `sessionToken` `TEXT NOT NULL`, unique
- `userId` `TEXT NOT NULL`
- `expires` `TIMESTAMP NOT NULL`

Relations:
- many-to-one: `User` via `userId`

Indexes and constraints:
- primary key: `id`
- unique: `sessionToken`
- foreign key: `userId -> User.id` with `ON DELETE CASCADE`

### `VerificationToken`

Purpose:
- Auth.js verification token table

Columns:
- `identifier` `TEXT NOT NULL`
- `token` `TEXT NOT NULL`, unique
- `expires` `TIMESTAMP NOT NULL`

Indexes and constraints:
- unique: `token`
- unique composite: (`identifier`, `token`)

### `Word`

Purpose:
- stores one vocabulary entry in a user's library

Columns:
- `id` `TEXT` primary key, default `cuid()`
- `userId` `TEXT NOT NULL`
- `text` `TEXT NOT NULL`
- `language` `TEXT NOT NULL DEFAULT 'en'`
- `note` `TEXT NULL`
- `entryJson` `JSONB NULL`
- `isPriority` `BOOLEAN NOT NULL DEFAULT false`
- `manualCategory` `TEXT NULL`
- `createdAt` `TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt` `TIMESTAMP NOT NULL`, auto-updated by Prisma

Relations:
- many-to-one: `User` via `userId`
- one-to-one optional inverse: `ReviewState`
- one-to-many: `ReviewLog`

Indexes and constraints:
- primary key: `id`
- index: (`userId`, `createdAt`)
- unique composite: (`userId`, `language`, `text`)
- foreign key: `userId -> User.id` with `ON DELETE CASCADE`

Notes:
- `entryJson` stores the structured dictionary payload captured during add-word flow
- uniqueness is case-insensitive only if enforced in application logic; the database key is exact-value

### `ReviewState`

Purpose:
- stores the current long-term learning state for a word

Columns:
- `id` `TEXT` primary key, default `cuid()`
- `userId` `TEXT NOT NULL`
- `wordId` `TEXT NOT NULL`, unique
- `lastReviewedAt` `TIMESTAMP NULL`
- `lapseCount` `INTEGER NOT NULL DEFAULT 0`
- `seenCount` `INTEGER NOT NULL DEFAULT 0`
- `consecutivePerfect` `INTEGER NOT NULL DEFAULT 0`
- `freezeRounds` `INTEGER NOT NULL DEFAULT 0`
- `isMastered` `BOOLEAN NOT NULL DEFAULT false`
- `masteryPhase` `INTEGER NOT NULL DEFAULT 0`
- `createdAt` `TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt` `TIMESTAMP NOT NULL`, auto-updated by Prisma

Relations:
- many-to-one: `User` via `userId`
- one-to-one: `Word` via `wordId`

Indexes and constraints:
- primary key: `id`
- unique: `wordId`
- index: (`userId`, `createdAt`)
- index: (`userId`, `freezeRounds`, `isMastered`)
- foreign key: `userId -> User.id` with `ON DELETE CASCADE`
- foreign key: `wordId -> Word.id` with `ON DELETE CASCADE`

### `ReviewLog`

Purpose:
- append-only log of each review event

Columns:
- `id` `TEXT` primary key, default `cuid()`
- `userId` `TEXT NOT NULL`
- `wordId` `TEXT NOT NULL`
- `grade` `INTEGER NOT NULL`
- `revealedAnswer` `BOOLEAN NOT NULL DEFAULT false`
- `msSpent` `INTEGER NULL`
- `reviewedAt` `TIMESTAMP NOT NULL DEFAULT now()`

Relations:
- many-to-one: `User` via `userId`
- many-to-one: `Word` via `wordId`

Indexes and constraints:
- primary key: `id`
- index: (`userId`, `reviewedAt`)
- index: (`wordId`, `reviewedAt`)
- foreign key: `userId -> User.id` with `ON DELETE CASCADE`
- foreign key: `wordId -> Word.id` with `ON DELETE CASCADE`

Notes:
- current app semantics use `grade` values:
  - `2` = known
  - `1` = fuzzy
  - `0` = unknown

### `StudySettings`

Purpose:
- per-user study configuration

Columns:
- `id` `TEXT` primary key, default `cuid()`
- `userId` `TEXT NOT NULL`, unique
- `sessionSize` `INTEGER NOT NULL DEFAULT 20`
- `freezeRounds` `INTEGER NOT NULL DEFAULT 3`
- `autoPlayAudio` `BOOLEAN NOT NULL DEFAULT true`
- `requireConsecutiveKnown` `BOOLEAN NOT NULL DEFAULT true`
- `createdAt` `TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt` `TIMESTAMP NOT NULL`, auto-updated by Prisma

Relations:
- one-to-one: `User` via `userId`

Indexes and constraints:
- primary key: `id`
- unique: `userId`
- foreign key: `userId -> User.id` with `ON DELETE CASCADE`

### `StudyRound`

Purpose:
- stores a user-defined round of selected vocabulary

Columns:
- `id` `TEXT` primary key, default `cuid()`
- `userId` `TEXT NOT NULL`
- `name` `TEXT NOT NULL`
- `status` `TEXT NOT NULL DEFAULT 'active'`
- `wordIds` `TEXT[] NOT NULL`
- `completedWordIds` `TEXT[] NOT NULL`
- `attemptedWordIds` `TEXT[] NOT NULL`
- `firstTryKnownWordIds` `TEXT[] NOT NULL`
- `createdAt` `TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt` `TIMESTAMP NOT NULL`, auto-updated by Prisma

Relations:
- many-to-one: `User` via `userId`
- one-to-many: `StudySession`

Indexes and constraints:
- primary key: `id`
- index: (`userId`, `status`, `createdAt`)
- foreign key: `userId -> User.id` with `ON DELETE CASCADE`

### `ApiToken`

Purpose:
- stores hashed API tokens for the Chrome extension / external ingestion API

Columns:
- `id` `TEXT` primary key, default `cuid()`
- `userId` `TEXT NOT NULL`
- `tokenHash` `TEXT NOT NULL`, unique
- `label` `TEXT NOT NULL DEFAULT 'Chrome Extension'`
- `createdAt` `TIMESTAMP NOT NULL DEFAULT now()`
- `lastUsedAt` `TIMESTAMP NULL`

Relations:
- many-to-one: `User` via `userId`

Indexes and constraints:
- primary key: `id`
- unique: `tokenHash`
- index: (`userId`)
- foreign key: `userId -> User.id` with `ON DELETE CASCADE`

Notes:
- raw tokens are not stored; only SHA-256 hashes are persisted

### `StudySession`

Purpose:
- stores one review session run inside a study round

Columns:
- `id` `TEXT` primary key, default `cuid()`
- `userId` `TEXT NOT NULL`
- `roundId` `TEXT NOT NULL`
- `type` `TEXT NOT NULL`
- `wordIds` `TEXT[] NOT NULL`
- `results` `JSONB NULL`
- `startedAt` `TIMESTAMP NOT NULL DEFAULT now()`
- `completedAt` `TIMESTAMP NULL`

Relations:
- many-to-one: `User` via `userId`
- many-to-one: `StudyRound` via `roundId`

Indexes and constraints:
- primary key: `id`
- index: (`userId`, `startedAt`)
- index: (`roundId`, `startedAt`)
- foreign key: `userId -> User.id` with `ON DELETE CASCADE`
- foreign key: `roundId -> StudyRound.id` with `ON DELETE CASCADE`

## Relationship Summary

One user owns:
- many `Word`
- many `ReviewState`
- many `ReviewLog`
- many `StudyRound`
- many `StudySession`
- many `ApiToken`
- zero or one `StudySettings`

One word has:
- zero or one `ReviewState`
- many `ReviewLog`

One study round has:
- many `StudySession`

## Migration Baseline

Current schema is built by these migrations in order:
- `20260221100547_mvp1`
- `20260221193000_review_session`
- `20260221202000_word_priority_category`
- `20260224120000_round_pack_model`
- `20260224142000_drop_stage_dueat`
- `20260225013000_study_rounds`
- `20260302120000_api_token`
- `20260302143000_word_entry_json`

## Operational Notes

- Production deployments should apply schema changes with:
  - `npm run prisma:migrate:deploy`
- Do not use `prisma migrate dev` in production
- Do not rewrite old migration history after a database has already applied it
