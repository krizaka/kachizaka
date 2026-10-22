import { normaliseName } from "./hash";

/** Words that are not the team: « FC », « de », « the »… */
const FILLER = new Set(["fc", "cf", "sc", "ac", "as", "afc", "cd", "ca", "de", "du", "des", "di", "da", "la", "le", "les", "the", "of", "and", "et", "el", "los", "las"]);

/**
 * The letters a crest carries, 1 to 3: the initials of the significant words (« Real Madrid » → RM, « Maple Leafs » →
 * ML, « Union Saint-Gilloise » → USG); a single word gives its first letters (« Canadiens » → CAN, never more than 3).
 * `max` lowers the limit (1–3). Always upper case.
 */
export function monogramOf(name: string, max: 1 | 2 | 3 = 3): string {
  const words = normaliseName(name).split(" ").filter(Boolean);
  const significant = words.filter((w) => !FILLER.has(w));
  const pool = significant.length ? significant : words;
  if (!pool.length) return "?";
  const letters = pool.length === 1 ? [...(pool[0] as string)].slice(0, Math.min(3, max)) : pool.map((w) => [...w][0] as string).slice(0, max);
  return letters.join("").toUpperCase();
}
