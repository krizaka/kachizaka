import type { MatchEvent } from "@kachizaka/core";

import type { EventsInput, EventsOutput, Fixture, FixturesInput, FixturesOutput, SportsFeed } from "./contract";

/**
 * A feed for tests and local development: fixtures and facts given up front, revealed as a test advances the "clock"
 * (`reveal`). It can repeat and shuffle what it returns — what real feeds do — to prove the pipeline does not care.
 */
export class FakeSportsFeed implements SportsFeed {
  readonly provider = "fake";
  private readonly visible = new Map<string, number>();
  calls = 0;

  constructor(
    private readonly data: { fixtures: Fixture[]; events: Record<string, MatchEvent[]> },
    private readonly behaviour: { repeat?: boolean; shuffle?: boolean } = {},
  ) {}

  /** Makes the first `count` facts of a match visible. */
  reveal(providerMatchId: string, count: number) {
    this.visible.set(providerMatchId, count);
  }

  async fixtures(input: FixturesInput): Promise<FixturesOutput> {
    this.calls++;
    const fixtures = this.data.fixtures.filter((f) => f.kickoffAt.slice(0, 10) >= input.from && f.kickoffAt.slice(0, 10) <= input.to);
    return { provider: this.provider, fixtures };
  }

  async events(input: EventsInput): Promise<EventsOutput> {
    this.calls++;
    const all = (this.data.events[input.providerMatchId] ?? []).slice(0, this.visible.get(input.providerMatchId) ?? 0);
    let events = all.filter((e) => e.seq > input.afterSeq);
    if (this.behaviour.repeat) events = [...all, ...events];
    if (this.behaviour.shuffle) events = [...events].reverse();
    return { provider: this.provider, providerMatchId: input.providerMatchId, events };
  }
}
