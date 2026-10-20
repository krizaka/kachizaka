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
