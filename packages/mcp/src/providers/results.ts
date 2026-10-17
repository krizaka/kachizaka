import type { MatchEvent } from "@kachizaka/core";

import type { Fixture } from "../contract";

/**
 * The facts of a played game, as a daily results feed can give them: kick-off, the score the provider now states (a
 * `correction`, which sets the score whatever it was), the final whistle. The ids come from the game and its result, so
 * the same result delivered twice is one fact (the pipeline stores a fact once, applies it in order). No goal-by-goal
 * claim and nothing « live »: these providers publish results, and the table says when it was last updated.
 */
export function resultEvents(fixture: Pick<Fixture, "providerMatchId" | "kickoffAt" | "result">): MatchEvent[] {
  const r = fixture.result;
  if (!r) return [];
  const id = `${fixture.providerMatchId}#${r.home}-${r.away}${r.overtime ? "-ot" : ""}`;
  const at = fixture.kickoffAt;
  return [
    { kind: "kickoff", providerEventId: `${fixture.providerMatchId}#kickoff`, seq: 1, at },
    { kind: "correction", providerEventId: `${id}#score`, seq: 2, at, home: r.home, away: r.away, overtime: r.overtime },
    { kind: "final", providerEventId: `${fixture.providerMatchId}#final`, seq: 3, at },
  ];
}
