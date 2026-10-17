import { DEFAULT_RULES, scorePrediction } from "@kachizaka/core";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { COMPETITIONS, EXAMPLES, PLANNED_RULES, SPORT_STATUS, SPORTS, sportView } from "./sports";

describe("the sports of a league", () => {
  it("are soccer, hockey and basketball, each with its competitions", () => {
    expect(SPORTS).toEqual(["soccer", "hockey", "basketball"]);
    expect(COMPETITIONS.hockey).toContain("NHL");
    expect(COMPETITIONS.basketball).toContain("NBA");
    expect(COMPETITIONS.soccer).toContain("MLS");
  });

  it("scores soccer with the real scorer, never typed by hand", () => {
    const v = sportView("soccer");
    expect(v.status).toBe("ready");
    for (const r of v.rows) {
      const ex = EXAMPLES.soccer.picks.find((p) => p.member === r.member)!;
      expect(r.points).toBe(scorePrediction(DEFAULT_RULES, ex.pick, EXAMPLES.soccer.actual).points);
    }
    expect(v.rows.map((r) => r.points)).toEqual([...v.rows.map((r) => r.points)].sort((a, b) => (b ?? 0) - (a ?? 0)));
    expect(v.seal).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("never shows points for a sport whose rules are not written yet", () => {
    for (const s of SPORTS.filter((s) => SPORT_STATUS[s] === "soon")) {
      const v = sportView(s);
      expect(v.rows.every((r) => r.points === null)).toBe(true);
      expect(v.seal).toBeNull();
    }
  });

  it("has words, in both languages, for every sport and planned rule", () => {
    for (const m of [en, fr]) {
      for (const s of SPORTS) expect(m.landing.league.sports[s].length).toBeGreaterThan(0);
      for (const [sport, ids] of Object.entries(PLANNED_RULES)) {
        for (const id of ids) expect((m.landing.league.rules as Record<string, Record<string, string>>)[sport][id]).toBeTruthy();
      }
    }
  });
});
