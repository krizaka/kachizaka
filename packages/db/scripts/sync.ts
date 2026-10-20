// `pnpm --filter @kachizaka/db sync [--competitions "NHL,Premier League,Ligue 1"] [--back 3] [--ahead 14]` (the connection
// settings are the database variables of the environment, as everywhere)
//
// The same pass the scheduled call of the app runs (`runSync`), by hand: fixtures and results for the competitions each open
// season follows, stored idempotently; `--competitions` also SETS the competitions of every open season. The feed is
// `src/feed.ts` — the one adapter module, until Orazaka's connector exists (krizaka/kachizaka#59).
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";

import { createDb, pg, poolConfig } from "../src/client";
import { migrate } from "../src/migrate";
import { seasons } from "../src/schema";
import { devFeed } from "../src/feed";
import { runSync } from "../src/sync";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const pool = new pg.Pool(poolConfig(process.env["DATABASE_URL"] ?? "", process.env["DATABASE_CA_CERT"], 2));
await migrate(pool, fileURLToPath(new URL("../drizzle", import.meta.url)));
const db = createDb(pool);
const chosen = arg("competitions")
  ?.split(",")
  .map((c) => c.trim())
  .filter(Boolean);
if (chosen?.length) await db.update(seasons).set({ competitions: chosen }).where(eq(seasons.status, "open"));
const out = await runSync(db, { feed: devFeed({ unlicensed: true }), now: new Date(), back: Number(arg("back", "3")), ahead: Number(arg("ahead", "14")) });
const failed = out.failed.length ? `, failed: ${out.failed.map((f) => `${f.competition} (${f.reason})`).join("; ")}` : "";
console.log(`kachizaka: ${out.seasons} open season(s): ${out.fixtures} fixtures, ${out.closed} closed${failed}`);
await pool.end();
