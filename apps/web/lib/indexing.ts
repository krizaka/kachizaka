/**
 * One flag decides whether this deployment is open to search engines: `APP_SEARCH_INDEXING=off` (every dev and preview
 * deployment) puts `noindex, nofollow` on every response, closes robots.txt (the sitemap stays served, noindex like everything else), and shows the
 * development notice in the footer. Anything else (default `on`) leaves the public pages open to crawlers.
 */
export const indexable = (env: Record<string, string | undefined> = process.env): boolean => env.APP_SEARCH_INDEXING?.trim().toLowerCase() !== "off";

export const NOINDEX = "noindex, nofollow";
/** Closed to every crawler, the sitemap still named: a noindex site serves the same files as an indexed one (check-seo-family). */
export const closedRobots = (siteUrl: string): string => `User-agent: *\nDisallow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;
