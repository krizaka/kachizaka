# Data sources — what feeds the fixtures and the results

Kachizaka reads **fixtures and final results** (never a live stream: the table says when it was last updated). Every source
sits behind the connector contract of `@kachizaka/mcp` (`SportsFeed`); the adapters in `packages/mcp/src/providers/` are
what Orazaka's MCP sports-feed connector runs, and the application reaches them through Orazaka's edge (AGENTS §2). Until
that connector is registered, `pnpm --filter @kachizaka/db sync` runs them server-side on a **development** database —
cached (10 minutes), one request per week of schedule, never from a browser, never in production.

| Competition | Sport | Provider | Licence / terms | Status |
| :--- | :--- | :--- | :--- | :--- |
| NHL | hockey | `api-web.nhle.com` (the NHL's public web API) | **No published licence** (undocumented public endpoint). Server-side, cached, low rate; swappable behind the adapter. | wired |
| Premier League | soccer | [openfootball](https://github.com/openfootball/football.json) | CC0 1.0 (public domain) | wired |
| Ligue 1 | soccer | openfootball | CC0 1.0 | wired |
| MLS · Champions League | soccer | — | openfootball has no MLS or Champions League file for the current season; football-data.org's free tier has the Champions League but no clear licence (ask the owner in writing) and no MLS | not offered |
| NBA | basketball | — | balldontlie (free key, 5 requests/min, 1 sport) — terms not retrieved; no NBA source is used until its terms allow it | not offered |

Rules: a competition whose provider's terms forbid the use is not offered; the provider and licence of each competition is
recorded here and in `COMPETITION_SOURCES` (`packages/mcp/src/providers/index.ts`). Research and the comparison of
sources: `docs/research/market-2026-10.md` §5.

Quirks worth knowing: openfootball has no match ids (ours is the competition, the date and the two teams, so a postponed
game appears as a new game) and gives local times without a zone (converted from the competition's zone); the NHL answers a
whole week per request.
