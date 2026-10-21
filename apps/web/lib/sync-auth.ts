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
 * The scheduled sync may use the non-licensed sources (ESPN's soccer results) only when APP_UNLICENSED_SOURCES=on says so
 * AND the request is not for the public host (www): never because of APP_SEARCH_INDEXING, which closes a host to search
 * engines but says nothing about a licence. The one deployment shares its database between dev and www, so it never sets it:
 * what the sync stores is what www shows. Set it only on a deployment with a database of its own (a development one); the
 * local runners (`pnpm sync`, `seed:league`) opt in directly. Otherwise a game without a licensed result stays « to play »
 * (a licensed source is required before any public launch, krizaka/kachizaka#59), and no page names the source.
 */
export const unlicensedSourcesAllowed = (env: Record<string, string | undefined> = process.env, host?: string | null): boolean => {
  if (env.APP_UNLICENSED_SOURCES?.trim().toLowerCase() !== "on" || !host) return false;
  const bare = (h: string) => h.trim().toLowerCase().replace(/:\d+$/, "");
  let publicHost = "";
  try {
    publicHost = bare(new URL(env.APP_PUBLIC_URL ?? "https://www.kachizaka.com").host);
  } catch {
    // an unreadable public URL: no host is known to be non-public, so nothing is allowed
    return false;
  }
  return bare(host) !== publicHost;
};
