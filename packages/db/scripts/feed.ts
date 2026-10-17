import { resultsFeed } from "@kachizaka/mcp";
import type { SportsFeed } from "@kachizaka/mcp";

/**
 * THE one place the dev runners (`sync`, `seed:league`) get their fixtures and results from. Today: the results adapters
 * called directly — a temporary exception to AGENTS §2 (krizaka/kachizaka#59). Swapping to Orazaka's connector is this
 * file alone: `return orazakaSportsFeed({ baseUrl: <AI_API_URL>, apiKey: <AI_API_KEY> })`.
 */
export function devFeed(): SportsFeed {
  return resultsFeed();
}
