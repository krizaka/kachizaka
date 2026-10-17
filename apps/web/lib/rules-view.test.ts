import { DEFAULT_BASKETBALL_RULES, DEFAULT_HOCKEY_RULES, DEFAULT_RULES } from "@kachizaka/core";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { ruleLines } from "./rules-view";

describe("the rules a league shows, per sport", () => {
  it("lists soccer's, hockey's and basketball's lines in reading order", () => {
    expect(ruleLines("soccer", DEFAULT_RULES).map((l) => l.id)).toEqual(["exactScore", "outcome", "goalDifference", "teamGoals", "finalMultiplier"]);
    expect(ruleLines("hockey", DEFAULT_HOCKEY_RULES)).toEqual([
      { id: "winner", kind: "points", value: 3 },
      { id: "goalDifference", kind: "points", value: 1 },
      { id: "overtime", kind: "points", value: 1 },
      { id: "playoffMultiplier", kind: "multiplier", value: 2 },
    ]);
    expect(ruleLines("basketball", DEFAULT_BASKETBALL_RULES).find((l) => l.id === "bands")).toEqual({ id: "bands", kind: "bands", value: [5, 10, 15] });
  });

  it("has a name, in both languages, for every line of every sport", () => {
    for (const m of [en, fr]) {
      const names = m.console.league.rules.names as Record<string, string>;
      for (const [sport, rules] of [["soccer", DEFAULT_RULES], ["hockey", DEFAULT_HOCKEY_RULES], ["basketball", DEFAULT_BASKETBALL_RULES]] as const) {
        for (const l of ruleLines(sport, rules)) expect(names[l.id], `${sport}.${l.id}`).toBeTruthy();
      }
    }
  });
});
