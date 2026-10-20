import { resultsFeed } from "@kachizaka/mcp";
import type { SportsFeed } from "@kachizaka/mcp";

/**
 * THE one place the dev runners (`sync`, `seed:league`) get their fixtures and results from. Today: the results adapters
 * called directly — a temporary exception to AGENTS §2 (krizaka/kachizaka#59). Swapping to Orazaka's connector is this
 * file alone: `return orazakaSportsFeed({ baseUrl: <AI_API_URL>, apiKey: <AI_API_KEY> })`.
 * `unlicensed` opts in to the non-licensed, dev-only sources (ESPN results): the dev runners and the dev deployment set it,
 * production never does.
 */
export function devFeed(options: { unlicensed?: boolean } = {}): SportsFeed {
  return resultsFeed({ unlicensed: options.unlicensed === true });
}
