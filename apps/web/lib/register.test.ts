import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import fr from "@/messages/fr.json";

const ROOT = join(__dirname, "..");

/** Every string of a catalogue with its key path. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

/**
 * Kachizaka is a game between friends: the French says « tu » everywhere (sign-in, console, privacy, e-mails), never a mix.
 * A message that must quote a text in « vous » (a legal quotation) is listed here, by key, with the reason — none today.
 */
const QUOTES: Record<string, string> = {};

const VOUS = /\b(vous|votre|vos)\b/i;
/** The « vous » imperative and the second plural (« Reconnectez », « Entrez ») — minus the words that merely end in -ez. */
const EZ = /\b(?!(?:chez|assez|nez|rez|bientôt)\b)[a-zàâçéèêëîïôûùüÿ]{3,}ez\b/i;

describe("the French is « tu » everywhere", () => {
  it("has no « vous », « votre », « vos » or -ez imperative in the catalogue, outside the listed legal quotes", () => {
    const bad = strings(fr)
      .filter(([key]) => !(key in QUOTES))
      .filter(([, text]) => VOUS.test(text) || EZ.test(text))
      .map(([key, text]) => `${key}: ${text}`);
    expect(bad).toEqual([]);
  });

  it("has no « vous » in the French e-mails", () => {
    const dir = join(ROOT, "mail-templates");
    const bad: string[] = [];
    for (const id of readdirSync(dir)) {
      let files: string[] = [];
      try {
        files = readdirSync(join(dir, id, "fr"));
      } catch {
        continue;
      }
      for (const f of files) {
        const text = readFileSync(join(dir, id, "fr", f), "utf8").replace(/<[^>]+>/g, " ");
        if (VOUS.test(text)) bad.push(`${id}/fr/${f}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps the quotes list honest: every listed key exists", () => {
    const keys = new Set(strings(fr).map(([k]) => k));
    for (const k of Object.keys(QUOTES)) expect(keys.has(k), k).toBe(true);
  });
});
