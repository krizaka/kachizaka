import { timingSafeEqual } from "node:crypto";

/**
 * The scheduled results sync (`POST /api/internal/sync`) is called by a GitHub Actions cron with a bearer token. No token
 * configured (OPERATOR_SYNC_TOKEN unset: every production, by default) = the door does not exist; a configured one must be
 * long enough and is compared in constant time. The token is never logged, never answered.
 */
export function syncAuthorised(authorization: string | null, token: string | undefined): "open" | "absent" | "refused" {
  if (!token || token.length < 32) return "absent";
  const given = /^Bearer (.+)$/.exec(authorization ?? "")?.[1] ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? "open" : "refused";
}

/**
 * The scheduled sync may use the non-licensed sources (ESPN's soccer results) on a development deployment only — the one
 * closed to search engines (APP_SEARCH_INDEXING=off). Anywhere else (production) it reads the licensed ones and a game
 * without a licensed result stays « to play »: a licensed source is required before any public launch (krizaka/kachizaka#59).
 */
export const unlicensedSourcesAllowed = (env: Record<string, string | undefined> = process.env): boolean => env.APP_SEARCH_INDEXING?.trim().toLowerCase() === "off";
