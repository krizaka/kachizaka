<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/kachizaka-dark.svg">
    <img src=".github/assets/kachizaka-light.svg" alt="Kachizaka" width="96">
  </picture>
</p>

# Kachizaka

**Predict with friends. Rules nobody can bend.** A league of friends, points only: the scoring rules are sealed when
the match kicks off, every point says which rule earned it, the standings move while the game is played, and the league
remembers every season — championship stars, trophies, streaks and your nemesis.

[![CI](https://github.com/krizaka/kachizaka/actions/workflows/ci.yml/badge.svg)](https://github.com/krizaka/kachizaka/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

Kachizaka (勝ち *kachi*, a win) is a Krizaka product **in development**: nothing is deployed, sign-up is closed.
**Points only — never money, stakes or odds.** The know-how it shows: **live data, in real time** — match facts read
through Orazaka's MCP connectors, applied once and in order, standings broadcast over `@krizaka/realtime`.

## What is built

- **Sealed rules** — a league's rule set is hashed (SHA-256 of its canonical JSON) and frozen at the first kick-off; the
  database refuses any change after it (a change is a new version, for matches not yet started). Each match keeps the
  seal it started with; a row that no longer matches its seal is never used to score.
- **Points explained** — every prediction is scored by one deterministic function and keeps the lines that add up.
- **Live pipeline** — match facts (`packages/mcp`, Orazaka's sports-feed connector) are stored once, applied in sequence
  order, the match rescored and the season's standings recomputed in one transaction; the change is then broadcast.
- **Predictions lock at kick-off** — by the clock and by the facts, in the database itself.
- **The league's memory** — podiums, streaks and nemeses across seasons (`packages/core`, table `honours`).

## Start

```bash
corepack enable && pnpm install          # Node 22, pnpm 10 — also installs the pre-push hook
cp .env.example .env                       # a local PostgreSQL URL (a database of your own)
pnpm dev                                   # http://localhost:3000
pnpm run check                             # lint · typecheck · tests (what the hook and CI run)
```

The database tests run on a real PostgreSQL 16: CI's service, or a Testcontainers one locally (Docker).

## Inside

| Path | |
| :-- | :-- |
| `apps/web` | Next.js 16: the public page, sign-in (`@krizaka/ui/auth-layout`), a league (sealed rules + live standings), the administration (admin.kachizaka.com), the BFF (`app/api`), the e-mail templates |
| `apps/mobile` | the Expo skeleton (joins the workspace in the mobile phase) |
| `packages/core` | the domain, pure: rules and their seal, scoring, ordered facts, standings, honours, realtime topics |
| `packages/db` | PostgreSQL schema (Drizzle), versioned SQL migrations with the rules the database enforces, the ingestion pipeline |
| `packages/mcp` | the sports-feed connector contract, its client over Orazaka's edge, a fake connector |

Rules for contributors and agents: [AGENTS.md](AGENTS.md). Security: [SECURITY.md](SECURITY.md).

---

A [Krizaka](https://www.krizaka.com) product · Made in Montréal · Apache-2.0
