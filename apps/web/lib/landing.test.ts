import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { HOME_SECTIONS, OUTCOMES, productStatus } from "./landing";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("the landing tells one story", () => {
  it("in five sections at most: the promise, what you can do, how it works, trust, the closing call", () => {
    expect(HOME_SECTIONS).toEqual(["hero", "outcomes", "how", "trust", "closing"]);
    const home = read("app/[locale]/page.tsx");
    const at = HOME_SECTIONS.map((id) => home.indexOf(`id="${id}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("shows three outcomes, each a way in", () => {
    expect(OUTCOMES).toHaveLength(3);
    for (const o of OUTCOMES) expect(en.landing.outcomes[o.id].cta.length).toBeGreaterThan(0);
  });

  it("has one primary action per section", () => {
    const sections = read("app/[locale]/page.tsx").split(/\bid="(?:hero|outcomes|how|trust|closing)"/).slice(1);
    for (const s of sections) expect((s.match(/variant="primary"/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("says its honest status, read from dev-preview.json", () => {
    const preview = JSON.parse(read("../../dev-preview.json")) as { criteria: Record<string, { evidence: string | null; na?: boolean }> };
    const gaps = Object.values(preview.criteria).some((c) => c.evidence === null && !c.na);
    expect(productStatus(preview)).toBe(gaps ? "development" : "preview");
  });

  it("speaks of points and predictions, never money or bets, and says Orazaka is planned until it is wired", () => {
    for (const m of [en, fr]) {
      const text = JSON.stringify(m.landing).toLowerCase();
      expect(text).not.toMatch(/\b(bet|bets|betting|wager|stake|payout|odds|prize pool|pari|paris|mise|cote|cagnotte)\b/);
    }
    const preview = JSON.parse(read("../../dev-preview.json")) as { criteria: Record<string, { evidence: string | null }> };
    if (preview.criteria["journey.ai-via-orazaka"]?.evidence === null) expect(en.landing.trust.powered).toMatch(/planned/i);
  });

  it("speaks the magpie's promise as the film says it", () => {
    expect(en.landing.how.magpie).toBe("The magpie keeps the score.");
    expect(fr.landing.how.magpie).toBe("La pie tient le score.");
  });
});

describe("the bar and the footer", () => {
  it("carry no version chip in the bar, one Product menu, and @krizaka/ui's SiteFooter", () => {
    const bar = read("components/SiteChrome.tsx");
    expect(bar).not.toContain("NavBar.Badge");
    expect(bar).not.toContain("APP_VERSION");
    expect(bar).toContain("NavBar.Menu");
    expect(read("components/SiteFooter.tsx")).toContain('from "@krizaka/ui/site-footer"');
  });
});
