# Data sources — what feeds the fixtures and the results

Kachizaka reads **fixtures and final results** (never a live stream: the table says when it was last updated). Every source
sits behind the connector contract of `@kachizaka/mcp` (`SportsFeed`); the adapters in `packages/mcp/src/providers/` are
what Orazaka's MCP sports-feed connector runs, and the application reaches them through Orazaka's edge (AGENTS §2). Until
that connector is registered, `pnpm --filter @kachizaka/db sync` runs them server-side on a **development** database —
cached (10 minutes), one request per week of schedule, never from a browser, never in production.

| Competition | Sport | Provider | Licence / terms | Status |
| :--- | :--- | :--- | :--- | :--- |
| NHL | hockey | `api-web.nhle.com` (the NHL's public web API) | **No published licence** (undocumented public endpoint). Server-side, cached, low rate; swappable behind the adapter. | wired |
| Premier League | soccer | fixtures: [openfootball](https://github.com/openfootball/football.json); results: ESPN's public scoreboard | openfootball CC0 1.0 (public domain). ESPN: **undocumented public endpoint, no published licence** (the NHL's grade) — results only | wired |
| Ligue 1 | soccer | openfootball + ESPN scoreboard (results) | same | wired |
| MLS · Champions League | soccer | — | openfootball has no MLS or Champions League file for the current season; football-data.org's free tier has the Champions League but no clear licence (ask the owner in writing) and no MLS | not offered |
| NBA | basketball | — | balldontlie (free key, 5 requests/min): its terms (read 2026-10-19) permit internal business use and publishing but do not state that a free key may feed a public app, add conditions for anything near wagering, and we hold no key — no NBA source is used until its terms are confirmed in writing. The scorer (winner + margin band) is ready; the sport stays « in preparation » | not offered |

Rules: a competition whose provider's terms forbid the use is not offered; the provider and licence of each competition is
recorded here and in `COMPETITION_SOURCES` (`packages/mcp/src/providers/index.ts`). Research and the comparison of
sources: `docs/research/market-2026-10.md` §5.

**Why a second source for soccer results (2026-10-19).** openfootball's volunteers stopped updating scores on 2026-09-20
(last commit 2026-09-22), so a game played since stayed « to play » for ever and no pick was scored. The fixtures stay
openfootball's (CC0); a game already played without a result takes it from ESPN's scoreboard (`providers/espn.ts`: one
request per day of games, matched by kick-off and team names, never guessed when two games fit). Like the NHL's, it is
flagged: no licence, so no guarantee; dropping `withEspnResults` in `providers/index.ts` returns to openfootball alone.

**The sync is scheduled** (2026-10-19): `.github/workflows/dev-sync.yml` calls `POST /api/internal/sync` of
dev.kachizaka.com every 30 minutes (bearer `OPERATOR_SYNC_TOKEN`; the route answers 404 where no token is set, so it
does not exist in production). It runs `runSync` (`packages/db/src/sync.ts`) — the same pass as `pnpm --filter @kachizaka/db sync` —
through the one adapter module `packages/db/src/feed.ts`. The table says when it was last updated; nothing is « live ».

Quirks worth knowing: openfootball has no match ids (ours is the competition, the date and the two teams, so a postponed
game appears as a new game) and gives local times without a zone (converted from the competition's zone); the NHL answers a
whole week per request.
