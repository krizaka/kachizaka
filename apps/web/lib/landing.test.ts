import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { COMPARE_ROWS, HOME_SECTIONS, productStatus, STORY_STEPS } from "./landing";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("the landing tells one story", () => {
  it("in five sections at most: the promise and the league, how it works, the comparison, trust, the closing call", () => {
    expect(HOME_SECTIONS).toEqual(["hero", "how", "compare", "trust", "closing"]);
    const home = read("app/[locale]/page.tsx");
    const at = HOME_SECTIONS.map((id) => home.indexOf(`id="${id}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("shows the league as it will look: the three sports, switchable, in text labels (no emoji)", () => {
    const view = read("components/LeagueView.tsx");
    expect(view).toContain('from "@krizaka/ui/tabs"');
    expect(view).not.toMatch(/\p{Extended_Pictographic}/u);
    for (const m of [en, fr]) expect(Object.values(m.landing.league.sports)).toHaveLength(3);
  });

  it("never shows a raw hash on the hero: the seal is behind the « Rules sealed » details", () => {
    const view = read("components/LeagueView.tsx");
    expect(view).toContain("<details");
    expect(view.indexOf("<details")).toBeLessThan(view.indexOf("v.seal"));
    expect(read("app/[locale]/page.tsx")).not.toContain("sealOf(");
  });

  it("tells the journey in four steps and compares on three to six rows, in both languages", () => {
    expect(STORY_STEPS).toHaveLength(4);
    expect(COMPARE_ROWS.length).toBeGreaterThanOrEqual(3);
    expect(COMPARE_ROWS.length).toBeLessThanOrEqual(6);
    for (const m of [en, fr]) {
      for (const id of STORY_STEPS) expect(m.landing.how.steps[id].title.length).toBeGreaterThan(0);
      for (const id of COMPARE_ROWS) {
        expect(m.landing.compare.rows[id].typical.key.length).toBeGreaterThan(0);
        expect(m.landing.compare.rows[id].kachizaka.key.length).toBeGreaterThan(0);
      }
    }
  });

  it("speaks Québec French with « tu » on the landing", () => {
    expect(JSON.stringify(fr.landing)).not.toMatch(/\b(vous|votre|vos|pronostiquez|créez|regardez)\b/i);
  });

  it("has one primary action per section", () => {
    const sections = read("app/[locale]/page.tsx").split(/\bid="(?:hero|how|compare|trust|closing)"/).slice(1);
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
