# Kachizaka — agent contract

> Governance of **`krizaka/kachizaka`**: Kachizaka, a Krizaka product — predictions among friends, **points only**.
> Agent-neutral: humans and AI agents follow the same rules. Epic: krizaka/.github#51.

## 1. What this repository is

- A **pnpm + Turborepo** monorepo — one product, one repository: `apps/web` (Next.js 16: the public page, sign-in, the
  member's space, the administration and the BFF — route handlers are the only HTTP surface), `apps/mobile` (Expo,
  skeleton), `packages/core` (the domain, pure and deterministic), `packages/db` (PostgreSQL 16, Drizzle, versioned
  migrations, the pipeline), `packages/mcp` (the sports-feed connector contract).
- **Built only from Krizaka bricks**: `@krizaka/ui` (auth-layout, app-shell, product-page, data-table, cards, mascots…),
  `@krizaka/query`, `@krizaka/i18n`, `@krizaka/icons`, `@krizaka/tokens` (`brands/kachizaka.css`), `@krizaka/realtime`.
  A missing generic component goes to krizaka-ui, released, then used — never copied here. No `@tanstack/*` import, no
  `fetch` in a client `useEffect`, no hand-written `<table>` or multi-field `<form>`.

## 2. Non-negotiables

- **Points only — never money.** No stake, wallet, payout, prize pool or odds, anywhere: real-money betting is regulated
  in Québec and Canada (Loto-Québec, Criminal Code s. 201–207). The words say "prediction" / « pronostic », never
  "bet" / « pari ». A test scans the schema for money columns and the e-mails for money words. A legal check comes
  before any launch.
- **Sealed rules.** A rule set is sealed (SHA-256 of its canonical JSON, `@kachizaka/core` `sealOf`) at the first kick-off
  it applies to; the database refuses any update or delete of a sealed version (`drizzle/0001_rules.sql`), a match keeps
  the seal it started with, and scoring re-checks the seal before using the rules. A change after kick-off is a new
  version. Never weaken a trigger to make a feature easier.
- **Facts are applied once and in order.** A match fact is stored once (provider id, `(match, seq)` unique), applied only
  when every earlier `seq` is, inside one transaction with the match row locked. The standings are recomputed whole,
  never patched. Broadcast happens after the commit; the bus is best-effort, the database is the truth.
- **External data only through Orazaka.** The sports feed is an MCP server registered on Orazaka; Kachizaka executes its
  tools on Orazaka's edge (`AI_API_URL`, `AI_API_KEY` = an `oz_` service key). AI, if any, likewise. Never a provider
  called directly.

- **Temporary exception (2026-10-17, krizaka/kachizaka#59)**: until an Orazaka connector runs the adapters of
  `packages/mcp/src/providers/`, the **dev** runners (`pnpm --filter @kachizaka/db sync`, `seed:league`) call the NHL web API
  and openfootball directly, server-side and cached, through the single module `packages/db/src/feed.ts` — swapping to
  `orazakaSportsFeed` is that file alone. Never from a browser, never in production. Licences: `docs/data-sources.md`.

## 3. The product is independent

- No link to another Krizaka product, no family switcher. Krizaka is the publisher, named **only in the footer** and the
  legal mentions. The colour is the Kachizaka brand (victorious gold accent over electric cobalt), the mark
  `KachizakaLogo` ("the sealed cup"), the bird **the magpie** (it keeps the score). Components use `--kz-*` roles only;
  dark and light are first-class.

## 4. Security of the dev environment

- Sign-up is closed server-side (`AUTH_SIGNUP_ENABLED` not `true` → 403); QA accounts only (`apps/web/scripts/qa-accounts.mjs`).
- The administration lives on **admin.kachizaka.com** (same app, host-routed by `proxy.ts` / `lib/host.ts`; 404 on the
  product host); a session, the ADMIN role **and** an address of `AUTH_ALLOWED_IPS`. Never indexed.
- Passwords scrypt; sessions random tokens kept as keyed hashes; rate limits on sign-in; CSP same-origin, HSTS.
- Environment variables by bounded context (`APP_`, `DATABASE_`, `AUTH_`, `ABUSE_`, `AI_`, `REALTIME_`), declared once in
  `apps/web/lib/env.ts`. Secrets never in the repository, never printed (`~/.krizaka-worktrees/tools/secret.sh`).
- **Not deployed.** No DigitalOcean app, no DNS: hosting is Oussama's decision.

## 5. Database

- PostgreSQL 16, schema in `packages/db/src/schema.ts` (Drizzle). `pnpm --filter @kachizaka/db db:generate` writes the
  next migration; rules the schema cannot say are custom SQL migrations. A merged migration is never edited.
- One database per worktree/session; never a shared or `*_demo` database from a session. Tests create a database per file
  on CI's PostgreSQL service or on a Testcontainers one.

## 6. Checks — local first, CI always

- **Before every push**: `pnpm run check` (lint · typecheck · tests), run by `.githooks/pre-push` (installed by
  `pnpm install`). Never push "to see what CI says". Never merge with a pending or red check (CodeQL included).
- **No test, not done**: every feature and fix ships with its tests; a fix starts with a failing test. The database rules
  are proven on a real PostgreSQL, never with mocks.
- Every visible page is checked in dark and light, desktop and phone. PR captures go to Bunny, never into the repository.
- Each notable UX choice has its entry in `docs/UX_DECISIONS.md`.

## 7. Text

- Every user-facing string is in `apps/web/messages/{en,fr}.json` (English the reference; `krizaka-i18n check` in
  `pnpm lint`); e-mails in `apps/web/mail-templates/<id>/<locale>/` (krizaka-notifications format). Never a locale ternary.

## Static rules & codemods (ast-grep)

The org code rules (addendum 2026-10-15) are lint rules, not review comments. [`@ast-grep/cli`](https://ast-grep.github.io)
is a **pinned devDependency** (no global install, CI reproduces local): `sgconfig.yml` + `rules/*.yml` (one rule per file,
with a message and, where safe, a `fix:`; written for Tsx and `.ts` is parsed as Tsx too, so each rule covers `.ts` and `.tsx`), `rule-tests/` (valid/invalid cases of each rule).

| Rule | What it refuses |
| :--- | :--- |
| `no-hand-ms-*`, `no-get-time-difference`, `no-get-time-arithmetic` | hand-written time arithmetic (`n * 60 * 1000`, `a.getTime() - b.getTime()`): date-fns, or a duration read from the settings |
| `no-env-in-domain` | an `env` import in domain code (`packages/*/src`, `src/`): the value arrives as a parameter |
| `no-db-in-service-or-rules` | a db client / schema import in `*.service.ts`, `*-service.ts`, `*.rules.ts`, `*-rules.ts` |
| `no-ts-enum` | the TypeScript `enum` keyword (`as const` object + derived type, or a Postgres enum) |
| `no-enum-string-compare` | `x.status === "OPEN"` (field named status/kind/role/reason/state/direction compared to a string literal) |
| `no-ambient-clock` | `new Date()` / `Date.now()` in domain code: the clock is injected |
| `no-types-at-package-root` | `types.ts` at a package root (`<feature>/<feature>.types.ts`) |
| `no-unjustified-numeric-export` | a numeric (or `…ToMilliseconds(n)`) `export const` in feature code without `// @fixed: <reason>` just above |
| `no-hand-made-nav`, `no-hand-made-language-switch` | a navigation bar that is not `NavBar` of @krizaka/ui (own Radix NavigationMenu, a local `NavBar`/`TopNav`), a hand-made language switch (`hrefLang` in a component, a row of `aria-pressed={locale === …}` buttons): use `NavBar` and `NavBar.Language` (« Navigation in the family », ui.krizaka.com) |

- **Run**: `npm run lint` runs everything (it includes `ast-grep test` and the ratchet). `npx ast-grep scan` lists the
  violations with their message; `npm run lint:sg:test` runs the rule tests.
- **Ratchet**: `scripts/sg-ratchet.mjs` counts the violations per rule and refuses any increase against
  `sg-ratchet.json` (same idea as `krizaka-ratchet` / `lint-ratchet.json`: the debt only goes down). Fixed some? Lock the gain with
  `npm run sg:ratchet:update` (it never raises a count and records a new rule at its current count). A new rule is
  added with its test in `rule-tests/` and its baseline in the same pull request. The script is identical in every
  Krizaka TypeScript repository (keep the copies identical; its unit test is `scripts/sg-ratchet.test.mjs`).
- **Codemods**: `npm run sg:fix` applies the `fix:` of the rules (`ast-grep scan --update-all`) and adds the date-fns import;
  behaviour is identical — run `npm run lint && npm test` after, and land the result in a small pull request.
- A rule is never silenced to get a PR green; fix the code, or (a business parameter that is a technical fact) justify it with `// @fixed:`.
