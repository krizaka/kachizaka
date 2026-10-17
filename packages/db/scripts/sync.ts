// `DATABASE_URL=… pnpm --filter @kachizaka/db sync [--competitions "NHL,Premier League,Ligue 1"] [--back 3] [--ahead 14]`
//
// Reads fixtures and results for the competitions each open season follows and stores them (idempotent); set the
// competitions of every open season with `--competitions`. This is the DEVELOPMENT runner of the results feed
// (@kachizaka/mcp `resultsFeed`): the same adapters are what Orazaka's MCP sports-feed connector will run, and the
// application then reaches them only through Orazaka's edge (AGENTS §2). Until that connector is registered this runner
// calls the providers itself, server-side, cached, at a low rate — never from a browser, never in production.
import { fileURLToPath } from "node:url";

import { resultsFeed, syncFixtures } from "@kachizaka/mcp";
import { eq } from "drizzle-orm";

import { createDb, pg, poolConfig } from "../src/client";
import { upsertFixtures } from "../src/fixtures";
import { migrate } from "../src/migrate";
import { ingest } from "../src/pipeline";
import { seasons } from "../src/schema";

const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle", import.meta.url));
const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const pool = new pg.Pool(poolConfig(process.env.DATABASE_URL ?? "", process.env.DATABASE_CA_CERT, 2));
await migrate(pool, MIGRATIONS_DIR);
const db = createDb(pool);
const chosen = arg("competitions")
  ?.split(",")
  .map((c) => c.trim())
  .filter(Boolean);
if (chosen?.length) await db.update(seasons).set({ competitions: chosen }).where(eq(seasons.status, "open"));
const feed = resultsFeed();
for (const season of await db.select().from(seasons).where(eq(seasons.status, "open"))) {
  if (!season.competitions.length) continue;
  const out = await syncFixtures({
    feed,
    competitions: season.competitions,
    from: day(-Number(arg("back", "3"))),
    to: day(Number(arg("ahead", "14"))),
    upsert: (fixtures) => upsertFixtures(db, season.id, "results", fixtures),
    ingest: (matchId, events) => ingest(db, matchId, events),
  });
  const failed = out.failed.length ? `, failed: ${out.failed.map((f) => `${f.competition} (${f.reason})`).join("; ")}` : "";
  console.log(`kachizaka: season ${season.label} (${season.id}): ${out.fixtures} fixtures, ${out.closed} closed${failed}`);
}
await pool.end();
