import { type ShowcaseLeague, showcaseLeague } from "@kachizaka/db";

import { db } from "./db";

const TTL_MS = 60_000;
const holder = globalThis as unknown as { __kachizakaShowcase?: Map<string, { at: number; value: ShowcaseLeague | null }> };

/**
 * The demonstration league the landing shows, read from the database and kept a minute in memory (one process; the page is
 * not a query per visit). No database, or a database that does not answer, is `null` — the landing then shows its example,
 * said so (`configured` is whether a database is set) — never an error page and never a stale claim of « live ».
 */
export async function loadShowcase(name: string, options: { configured: boolean; now?: () => number }): Promise<ShowcaseLeague | null> {
  if (!options.configured) return null;
  const now = options.now ?? Date.now;
  const cache = (holder.__kachizakaShowcase ??= new Map());
  const hit = cache.get(name);
  if (hit && now() - hit.at < TTL_MS) return hit.value;
  try {
    const value = await showcaseLeague(db(), { name, results: 3 });
    cache.set(name, { at: now(), value });
    return value;
  } catch (error) {
    console.error("showcase: the league could not be read", error instanceof Error ? error.message : error);
    return hit?.value ?? null;
  }
}
