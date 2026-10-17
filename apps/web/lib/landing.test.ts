import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { COMPARE_ROWS, FAQ_IDS, HOME_SECTIONS, POINT_RULES, productStatus, STORY_STEPS } from "./landing";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("the landing is the product landing template of @krizaka/ui, at the Yomizaka level", () => {
  const home = read("app/[locale]/page.tsx");

  it("is a LandingPage: split hero with the league table as the visual, a band of figures, a bento, our sections, the closing call", () => {
    expect(home).toContain('from "@krizaka/ui/landing-page"');
    for (const prop of ["eyebrow=", "visual={", "visualLabel=", "proofs={[", "features={[", "closing={{"]) expect(home).toContain(prop);
    expect(home).toContain("<LeagueView");
  });

  it("tells its story in this order", () => {
    expect(HOME_SECTIONS).toEqual(["hero", "features", "how", "points", "compare", "trust", "faq", "closing"]);
    const marks = ["<LandingPage", "features={[", 'id="how"', "<PointsBreakdown", 'id="compare"', 'id="trust"', "<FaqSection", "closing={{"];
    const at = marks.map((m) => home.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    const body = at.slice(0, -1);
    expect([...body].sort((a, b) => a - b)).toEqual(body);
  });

  it("uses the family's blocks: NumberTicker (real figures), DeviceFrame, ComparisonTable, the magpie, LinkCard", () => {
    expect(home).toContain("<NumberTicker");
    expect(read("components/LeagueStory.tsx")).toContain("DeviceFrame");
    expect(home).toContain("@krizaka/ui/comparison-table");
    expect(home).toContain('bird="magpie"');
    expect(read("components/home/PointsBreakdown.tsx")).toContain("NumberTicker");
  });

  it("has one primary action in the hero and one in the closing call", () => {
    expect((home.match(/variant="primary"/g) ?? []).length).toBe(2);
  });

  it("the band's figures are read from the example league and the real scorer, never typed", () => {
    expect(home).toContain("FRIENDS.length");
    expect(home).toContain("SPORTS.length");
    expect(home).toContain("DEFAULT_RULES.exactScore");
  });
});

describe("the points are the real scorer's", () => {
  it("lists the rules of @kachizaka/core that are worth points, with the default values", () => {
    expect(POINT_RULES.map((r) => [r.id, r.points])).toEqual([["exactScore", 5], ["outcome", 2], ["goalDifference", 1]]);
  });
  it("explains each rule and the final's multiplier, in both languages", () => {
    for (const m of [en, fr]) {
      for (const r of POINT_RULES) expect(m.landing.points.items[r.id].title && m.landing.points.items[r.id].text, r.id).toBeTruthy();
      expect(m.landing.points.final).toBeTruthy();
    }
  });
});

describe("the FAQ", () => {
  it("answers each question in both languages, never about money, and names Orazaka only where it is planned", () => {
    for (const m of [en, fr]) {
      for (const id of FAQ_IDS) expect(m.landing.faq.items[id].q && m.landing.faq.items[id].a, id).toBeTruthy();
      const withEngine = Object.entries(m.landing.faq.items).filter(([, v]) => /orazaka/i.test(v.a)).map(([k]) => k);
      expect(withEngine).toEqual(["engine"]);
      expect(m.landing.faq.items.engine.a).toMatch(/planned|prévu/i);
    }
  });
});

describe("the landing keeps its other guarantees", () => {
  it("shows the league as it will look: the three sports, switchable, with icons from @krizaka/icons (no emoji)", () => {
    const view = read("components/LeagueView.tsx") + read("components/SportIcon.tsx");
    expect(view).toContain('from "@krizaka/ui/tabs"');
    expect(view).toContain('from "@krizaka/icons"');
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

describe("the journey on a phone", () => {
  it("lets a step's words wrap and the column shrink, so a phone never scrolls sideways (dev.kachizaka.com was 690 px wide at 390)", () => {
    const story = read("components/LeagueStory.tsx");
    expect(story).toContain("whitespace-normal");
    expect(story).toContain("minmax(0,1fr)");
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

describe("the bar's language switch", () => {
  it("is the family's (a globe and the current code), in the bar and in the phone panel's preferences — never a pill naming the other language", () => {
    const bar = read("components/SiteChrome.tsx");
    expect(bar).toContain("NavBar.Language");
    expect(bar).toContain("NavBar.MobilePreferences");
    expect(bar).toContain("languagesFor(");
    expect(bar).not.toContain("hrefLang");
    expect(bar).not.toContain("otherLocale");
  });
});

describe("the responsive guard", () => {
  it("is a script that checks 360, 390, 430, 768, 1024 and 1440 px in both themes, and CI runs it", () => {
    const script = readFileSync(join(ROOT, "../../scripts/check-overflow.mjs"), "utf8");
    expect(script).toContain("export const WIDTHS = [360, 390, 430, 768, 1024, 1440]");
    expect(script).toContain('["dark", "light"]');
    expect(JSON.parse(readFileSync(join(ROOT, "../../package.json"), "utf8")).scripts["check:overflow"]).toBe("node scripts/check-overflow.mjs");
    expect(readFileSync(join(ROOT, "../../.github/workflows/ci.yml"), "utf8")).toContain("check:overflow");
  });
});
